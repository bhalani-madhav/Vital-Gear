const {
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
} = require('../../utils/responseHandler');

describe('Response Handler', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('sendSuccess', () => {
    test('should send success response with default values', () => {
      sendSuccess(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Success'
      });
    });

    test('should send success response with data and custom message', () => {
      const data = { id: 1, name: 'Test' };
      const message = 'Data retrieved successfully';

      sendSuccess(mockRes, data, message, 200);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message,
        data
      });
    });

    test('should send success response with meta information', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const meta = { total: 2, page: 1 };

      sendSuccess(mockRes, data, 'Success', 200, meta);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Success',
        data,
        meta
      });
    });
  });

  describe('sendError', () => {
    test('should send error response with default values', () => {
      sendError(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal Server Error'
      });
    });

    test('should send error response with custom message and status', () => {
      const message = 'Custom error message';
      const statusCode = 400;

      sendError(mockRes, message, statusCode);

      expect(mockRes.status).toHaveBeenCalledWith(statusCode);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message
      });
    });

    test('should send error response with error details', () => {
      const message = 'Validation failed';
      const errorDetails = { field: 'email', issue: 'invalid format' };

      sendError(mockRes, message, 400, errorDetails);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message,
        error: errorDetails
      });
    });
  });

  describe('sendValidationError', () => {
    test('should send validation error response', () => {
      const validationErrors = [
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password is too short' }
      ];

      sendValidationError(mockRes, validationErrors);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        error: {
          type: 'ValidationError',
          details: validationErrors
        }
      });
    });

    test('should send validation error with custom message', () => {
      const validationErrors = [{ field: 'name', message: 'Name is required' }];
      const customMessage = 'Input validation failed';

      sendValidationError(mockRes, validationErrors, customMessage);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: customMessage,
        error: {
          type: 'ValidationError',
          details: validationErrors
        }
      });
    });
  });

  describe('sendUnauthorized', () => {
    test('should send unauthorized response with default message', () => {
      sendUnauthorized(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized access',
        error: { type: 'AuthenticationError' }
      });
    });

    test('should send unauthorized response with custom message', () => {
      const message = 'Invalid token';

      sendUnauthorized(mockRes, message);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message,
        error: { type: 'AuthenticationError' }
      });
    });
  });

  describe('sendForbidden', () => {
    test('should send forbidden response', () => {
      sendForbidden(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access forbidden',
        error: { type: 'AuthorizationError' }
      });
    });
  });

  describe('sendNotFound', () => {
    test('should send not found response', () => {
      const message = 'User not found';

      sendNotFound(mockRes, message);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message,
        error: { type: 'NotFoundError' }
      });
    });
  });

  describe('sendConflict', () => {
    test('should send conflict response', () => {
      const message = 'Email already exists';
      const conflictDetails = { field: 'email', value: 'test@example.com' };

      sendConflict(mockRes, message, conflictDetails);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message,
        error: {
          type: 'ConflictError',
          details: conflictDetails
        }
      });
    });
  });

  describe('sendPaginatedResponse', () => {
    test('should send paginated response with correct meta', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const pagination = { page: 1, limit: 10, total: 25 };

      sendPaginatedResponse(mockRes, data, pagination);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Data retrieved successfully',
        data,
        meta: {
          pagination: {
            page: 1,
            limit: 10,
            total: 25,
            totalPages: 3,
            hasNext: true,
            hasPrev: false
          }
        }
      });
    });

    test('should calculate pagination meta correctly for last page', () => {
      const data = [{ id: 21 }, { id: 22 }];
      const pagination = { page: 3, limit: 10, total: 22 };

      sendPaginatedResponse(mockRes, data, pagination);

      const expectedMeta = {
        pagination: {
          page: 3,
          limit: 10,
          total: 22,
          totalPages: 3,
          hasNext: false,
          hasPrev: true
        }
      };

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Data retrieved successfully',
        data,
        meta: expectedMeta
      });
    });
  });

  describe('sendCreated', () => {
    test('should send created response', () => {
      const data = { id: 1, name: 'New Item' };
      const message = 'Item created successfully';

      sendCreated(mockRes, data, message);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message,
        data
      });
    });
  });

  describe('sendNoContent', () => {
    test('should send no content response', () => {
      sendNoContent(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Operation completed successfully'
      });
    });
  });

  describe('sendRateLimitExceeded', () => {
    test('should send rate limit exceeded response', () => {
      const rateLimitInfo = { limit: 100, remaining: 0, resetTime: '2024-01-01T00:00:00Z' };

      sendRateLimitExceeded(mockRes, 'Too many requests', rateLimitInfo);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Too many requests',
        error: {
          type: 'RateLimitError',
          details: rateLimitInfo
        }
      });
    });
  });
});