const { sendError, sendValidationError } = require('../utils/responseHandler');

/**
 * Custom Application Error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorType = 'ApplicationError', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async error handler wrapper
 * Catches async errors and passes them to error handling middleware
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle Mongoose validation errors
 */
const handleValidationError = (error) => {
  const errors = Object.values(error.errors).map(err => ({
    field: err.path,
    message: err.message,
    value: err.value
  }));

  return {
    message: 'Validation failed',
    statusCode: 400,
    errorType: 'ValidationError',
    details: errors
  };
};

/**
 * Handle Mongoose duplicate key errors
 */
const handleDuplicateKeyError = (error) => {
  const field = Object.keys(error.keyValue)[0];
  const value = error.keyValue[field];

  return {
    message: `${field} '${value}' already exists`,
    statusCode: 409,
    errorType: 'DuplicateError',
    details: {
      field,
      value,
      message: `A record with this ${field} already exists`
    }
  };
};

/**
 * Handle Mongoose cast errors (invalid ObjectId, etc.)
 */
const handleCastError = (error) => {
  return {
    message: `Invalid ${error.path}: ${error.value}`,
    statusCode: 400,
    errorType: 'CastError',
    details: {
      field: error.path,
      value: error.value,
      expectedType: error.kind
    }
  };
};

/**
 * Handle JWT errors
 */
const handleJWTError = (error) => {
  let message = 'Invalid token';
  
  if (error.name === 'TokenExpiredError') {
    message = 'Token has expired';
  } else if (error.name === 'JsonWebTokenError') {
    message = 'Invalid token format';
  }

  return {
    message,
    statusCode: 401,
    errorType: 'AuthenticationError',
    details: {
      tokenError: error.name,
      originalMessage: error.message
    }
  };
};

/**
 * Handle MongoDB connection errors
 */
const handleMongoError = (error) => {
  let message = 'Database operation failed';
  let statusCode = 500;

  if (error.code === 11000) {
    return handleDuplicateKeyError(error);
  }

  if (error.name === 'MongoNetworkError') {
    message = 'Database connection failed';
  } else if (error.name === 'MongoTimeoutError') {
    message = 'Database operation timed out';
  }

  return {
    message,
    statusCode,
    errorType: 'DatabaseError',
    details: {
      mongoError: error.name,
      code: error.code
    }
  };
};

/**
 * Development error response (includes stack trace)
 */
const sendErrorDev = (err, res) => {
  const errorResponse = {
    success: false,
    message: err.message,
    error: {
      type: err.errorType || 'Error',
      statusCode: err.statusCode,
      stack: err.stack,
      ...(err.details && { details: err.details })
    }
  };

  res.status(err.statusCode || 500).json(errorResponse);
};

/**
 * Production error response (sanitized)
 */
const sendErrorProd = (err, res) => {
  // Operational errors: send message to client
  if (err.isOperational) {
    const errorResponse = {
      success: false,
      message: err.message,
      error: {
        type: err.errorType,
        ...(err.details && { details: err.details })
      }
    };

    return res.status(err.statusCode).json(errorResponse);
  }

  // Programming or unknown errors: don't leak error details
  console.error('ERROR:', err);

  return sendError(res, 'Something went wrong', 500, {
    type: 'InternalServerError'
  });
};

/**
 * Global error handling middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for monitoring
  console.error(`Error ${err.statusCode || 500}: ${err.message}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const validationError = handleValidationError(err);
    error = new AppError(
      validationError.message,
      validationError.statusCode,
      validationError.errorType,
      validationError.details
    );
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const duplicateError = handleDuplicateKeyError(err);
    error = new AppError(
      duplicateError.message,
      duplicateError.statusCode,
      duplicateError.errorType,
      duplicateError.details
    );
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    const castError = handleCastError(err);
    error = new AppError(
      castError.message,
      castError.statusCode,
      castError.errorType,
      castError.details
    );
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const jwtError = handleJWTError(err);
    error = new AppError(
      jwtError.message,
      jwtError.statusCode,
      jwtError.errorType,
      jwtError.details
    );
  }

  // MongoDB errors
  if (err.name && err.name.startsWith('Mongo')) {
    const mongoError = handleMongoError(err);
    error = new AppError(
      mongoError.message,
      mongoError.statusCode,
      mongoError.errorType,
      mongoError.details
    );
  }

  // Express validator errors
  if (err.array && typeof err.array === 'function') {
    const validationErrors = err.array().map(error => ({
      field: error.param || error.path,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    return sendValidationError(res, validationErrors);
  }

  // Send error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

/**
 * Handle 404 errors for undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'NotFoundError',
    {
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    }
  );

  next(error);
};

/**
 * Validation error formatter for express-validator
 */
const formatValidationErrors = (errors) => {
  return errors.map(error => ({
    field: error.param || error.path,
    message: error.msg,
    value: error.value,
    location: error.location
  }));
};

module.exports = {
  AppError,
  asyncHandler,
  globalErrorHandler,
  notFoundHandler,
  formatValidationErrors,
  handleValidationError,
  handleDuplicateKeyError,
  handleCastError,
  handleJWTError,
  handleMongoError
};