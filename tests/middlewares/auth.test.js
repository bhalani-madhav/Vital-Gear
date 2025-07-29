const { authenticateToken, optionalAuth } = require('../../middlewares/auth');
const { generateToken } = require('../../utils/jwt');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    role: 'user'
  };

  describe('authenticateToken', () => {
    it('should authenticate valid token', async () => {
      const token = generateToken(mockUser);
      req.headers.authorization = `Bearer ${token}`;

      await authenticateToken(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(mockUser._id);
      expect(req.user.email).toBe(mockUser.email);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Access token is required',
          code: 'MISSING_TOKEN'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with malformed authorization header', async () => {
      req.headers.authorization = 'InvalidFormat token';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Access token is required',
          code: 'MISSING_TOKEN'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      req.headers.authorization = 'Bearer invalid.token.here';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with empty token', async () => {
      req.headers.authorization = 'Bearer ';

      await authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should authenticate valid token when provided', async () => {
      const token = generateToken(mockUser);
      req.headers.authorization = `Bearer ${token}`;

      await optionalAuth(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(mockUser._id);
      expect(req.user.email).toBe(mockUser.email);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when no token provided', async () => {
      await optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when invalid token provided', async () => {
      req.headers.authorization = 'Bearer invalid.token.here';

      await optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when malformed header provided', async () => {
      req.headers.authorization = 'InvalidFormat token';

      await optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});