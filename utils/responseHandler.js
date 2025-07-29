/**
 * Standardized API Response Handler
 * Provides consistent response format across all endpoints
 */

/**
 * Standard API response structure
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Indicates if the request was successful
 * @property {string} message - Human-readable message
 * @property {*} data - Response data (optional)
 * @property {Object} error - Error details (optional)
 * @property {Object} meta - Metadata like pagination info (optional)
 */

/**
 * Send successful response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {Object} meta - Additional metadata
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200, meta = null) => {
  const response = {
    success: true,
    message,
    ...(data !== null && { data }),
    ...(meta && { meta })
  };

  return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Object} errorDetails - Additional error details
 * @param {*} data - Optional data to include
 */
const sendError = (res, message = 'Internal Server Error', statusCode = 500, errorDetails = null, data = null) => {
  const response = {
    success: false,
    message,
    ...(errorDetails && { error: errorDetails }),
    ...(data !== null && { data })
  };

  return res.status(statusCode).json(response);
};

/**
 * Send validation error response
 * @param {Object} res - Express response object
 * @param {Array|Object} validationErrors - Validation error details
 * @param {string} message - Error message
 */
const sendValidationError = (res, validationErrors, message = 'Validation failed') => {
  const response = {
    success: false,
    message,
    error: {
      type: 'ValidationError',
      details: validationErrors
    }
  };

  return res.status(400).json(response);
};

/**
 * Send unauthorized response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const sendUnauthorized = (res, message = 'Unauthorized access') => {
  return sendError(res, message, 401, { type: 'AuthenticationError' });
};

/**
 * Send forbidden response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const sendForbidden = (res, message = 'Access forbidden') => {
  return sendError(res, message, 403, { type: 'AuthorizationError' });
};

/**
 * Send not found response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
const sendNotFound = (res, message = 'Resource not found') => {
  return sendError(res, message, 404, { type: 'NotFoundError' });
};

/**
 * Send conflict response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} conflictDetails - Details about the conflict
 */
const sendConflict = (res, message = 'Resource conflict', conflictDetails = null) => {
  return sendError(res, message, 409, { 
    type: 'ConflictError',
    ...(conflictDetails && { details: conflictDetails })
  });
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination info
 * @param {string} message - Success message
 */
const sendPaginatedResponse = (res, data, pagination, message = 'Data retrieved successfully') => {
  const meta = {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1
    }
  };

  return sendSuccess(res, data, message, 200, meta);
};

/**
 * Send created response
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} message - Success message
 */
const sendCreated = (res, data, message = 'Resource created successfully') => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Send no content response
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 */
const sendNoContent = (res, message = 'Operation completed successfully') => {
  return res.status(204).json({
    success: true,
    message
  });
};

/**
 * Send rate limit exceeded response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} rateLimitInfo - Rate limit details
 */
const sendRateLimitExceeded = (res, message = 'Rate limit exceeded', rateLimitInfo = null) => {
  return sendError(res, message, 429, {
    type: 'RateLimitError',
    ...(rateLimitInfo && { details: rateLimitInfo })
  });
};

module.exports = {
  sendSuccess,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendPaginatedResponse,
  sendCreated,
  sendNoContent,
  sendRateLimitExceeded
};