const { validatePasswordStrength } = require('../utils/password');

/**
 * Middleware to validate password strength
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validatePassword = (req, res, next) => {
  const { password } = req.body;
  
  const validation = validatePasswordStrength(password);
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Password does not meet security requirements',
        code: 'WEAK_PASSWORD',
        details: {
          errors: validation.errors
        }
      }
    });
  }
  
  next();
};

/**
 * Middleware to validate password confirmation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validatePasswordConfirmation = (req, res, next) => {
  const { password, confirmPassword } = req.body;
  
  if (!confirmPassword) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Password confirmation is required',
        code: 'MISSING_PASSWORD_CONFIRMATION'
      }
    });
  }
  
  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Passwords do not match',
        code: 'PASSWORD_MISMATCH'
      }
    });
  }
  
  next();
};

/**
 * Combined middleware for password validation and confirmation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validatePasswordAndConfirmation = (req, res, next) => {
  validatePassword(req, res, (err) => {
    if (err) return next(err);
    validatePasswordConfirmation(req, res, next);
  });
};

module.exports = {
  validatePassword,
  validatePasswordConfirmation,
  validatePasswordAndConfirmation
};