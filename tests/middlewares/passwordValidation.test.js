const {
  validatePassword,
  validatePasswordConfirmation,
  validatePasswordAndConfirmation
} = require('../../middlewares/passwordValidation');

describe('Password Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('validatePassword', () => {
    it('should pass validation for strong password', () => {
      req.body.password = 'StrongPass123!';

      validatePassword(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject weak password', () => {
      req.body.password = 'weak';

      validatePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Password does not meet security requirements',
          code: 'WEAK_PASSWORD',
          details: {
            errors: expect.arrayContaining([
              expect.stringContaining('Password must be at least 8 characters long')
            ])
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject password without uppercase letter', () => {
      req.body.password = 'password123!';

      validatePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Password does not meet security requirements',
          code: 'WEAK_PASSWORD',
          details: {
            errors: expect.arrayContaining([
              'Password must contain at least one uppercase letter'
            ])
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject common weak passwords', () => {
      req.body.password = 'password';

      validatePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Password does not meet security requirements',
          code: 'WEAK_PASSWORD',
          details: {
            errors: expect.arrayContaining([
              'Password is too common and easily guessable'
            ])
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle missing password', () => {
      // req.body.password is undefined

      validatePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Password does not meet security requirements',
          code: 'WEAK_PASSWORD',
          details: {
            errors: expect.arrayContaining([
              'Password is required'
            ])
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validatePasswordConfirmation', () => {
    it('should pass validation when passwords match', () => {
      req.body.password = 'StrongPass123!';
      req.body.confirmPassword = 'StrongPass123!';

      validatePasswordConfirmation(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject when passwords do not match', () => {
      req.body.password = 'StrongPass123!';
      req.body.confirmPassword = 'DifferentPass123!';

      validatePasswordConfirmation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Passwords do not match',
          code: 'PASSWORD_MISMATCH'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when confirmPassword is missing', () => {
      req.body.password = 'StrongPass123!';
      // req.body.confirmPassword is undefined

      validatePasswordConfirmation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Password confirmation is required',
          code: 'MISSING_PASSWORD_CONFIRMATION'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when confirmPassword is empty string', () => {
      req.body.password = 'StrongPass123!';
      req.body.confirmPassword = '';

      validatePasswordConfirmation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Password confirmation is required',
          code: 'MISSING_PASSWORD_CONFIRMATION'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validatePasswordAndConfirmation', () => {
    it('should pass validation for strong matching passwords', () => {
      req.body.password = 'StrongPass123!';
      req.body.confirmPassword = 'StrongPass123!';

      validatePasswordAndConfirmation(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject weak password before checking confirmation', () => {
      req.body.password = 'weak';
      req.body.confirmPassword = 'weak';

      validatePasswordAndConfirmation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Password does not meet security requirements',
          code: 'WEAK_PASSWORD',
          details: {
            errors: expect.arrayContaining([
              expect.stringContaining('Password must be at least 8 characters long')
            ])
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject strong password with mismatched confirmation', () => {
      req.body.password = 'StrongPass123!';
      req.body.confirmPassword = 'DifferentPass123!';

      validatePasswordAndConfirmation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Passwords do not match',
          code: 'PASSWORD_MISMATCH'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});