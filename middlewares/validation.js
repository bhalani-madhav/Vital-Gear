const { body, param, query, validationResult } = require('express-validator');
const { sendValidationError } = require('../utils/responseHandler');
const { formatValidationErrors } = require('./errorHandler');

/**
 * Middleware to handle validation results
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = formatValidationErrors(errors.array());
    return sendValidationError(res, formattedErrors);
  }
  
  next();
};

/**
 * Common validation rules
 */
const validationRules = {
  // Email validation
  email: () => 
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail()
      .toLowerCase(),

  // Password validation
  password: (field = 'password') =>
    body(field)
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  // Name validation
  name: (field = 'name') =>
    body(field)
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage(`${field} must be between 2 and 50 characters`)
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage(`${field} can only contain letters and spaces`),

  // Required string validation
  requiredString: (field, minLength = 1, maxLength = 255) =>
    body(field)
      .trim()
      .notEmpty()
      .withMessage(`${field} is required`)
      .isLength({ min: minLength, max: maxLength })
      .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`),

  // Optional string validation
  optionalString: (field, maxLength = 255) =>
    body(field)
      .optional()
      .trim()
      .isLength({ max: maxLength })
      .withMessage(`${field} cannot exceed ${maxLength} characters`),

  // MongoDB ObjectId validation
  mongoId: (field = 'id') =>
    param(field)
      .isMongoId()
      .withMessage(`Invalid ${field} format`),

  // Numeric validation
  number: (field, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    body(field)
      .isNumeric()
      .withMessage(`${field} must be a number`)
      .custom((value) => {
        const num = parseFloat(value);
        if (num < min || num > max) {
          throw new Error(`${field} must be between ${min} and ${max}`);
        }
        return true;
      }),

  // Positive integer validation
  positiveInteger: (field) =>
    body(field)
      .isInt({ min: 1 })
      .withMessage(`${field} must be a positive integer`),

  // Boolean validation
  boolean: (field) =>
    body(field)
      .isBoolean()
      .withMessage(`${field} must be a boolean value`),

  // Array validation
  array: (field, minLength = 0, maxLength = 100) =>
    body(field)
      .isArray({ min: minLength, max: maxLength })
      .withMessage(`${field} must be an array with ${minLength} to ${maxLength} items`),

  // Enum validation
  enum: (field, allowedValues) =>
    body(field)
      .isIn(allowedValues)
      .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`),

  // Phone number validation
  phone: (field = 'phone') =>
    body(field)
      .optional()
      .isMobilePhone()
      .withMessage('Please provide a valid phone number'),

  // URL validation
  url: (field) =>
    body(field)
      .optional()
      .isURL()
      .withMessage(`${field} must be a valid URL`),

  // Date validation
  date: (field) =>
    body(field)
      .optional()
      .isISO8601()
      .withMessage(`${field} must be a valid date`),

  // Pagination validation
  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
    query('sort')
      .optional()
      .isString()
      .withMessage('Sort must be a string'),
    query('order')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Order must be either asc or desc')
  ]
};

/**
 * User registration validation
 */
const validateUserRegistration = [
  validationRules.name('firstName'),
  validationRules.name('lastName'),
  validationRules.email(),
  validationRules.password(),
  validationRules.phone('phone'),
  handleValidationErrors
];

/**
 * User login validation
 */
const validateUserLogin = [
  validationRules.email(),
  validationRules.requiredString('password', 1),
  handleValidationErrors
];

/**
 * Product creation validation
 */
const validateProductCreation = [
  validationRules.requiredString('name', 2, 200),
  validationRules.requiredString('description', 10, 2000),
  validationRules.requiredString('brandName', 2, 100),
  validationRules.enum('category', [
    'Pre Workout', 'Post Workout', 'Protein', 'Vegan Protein', 
    'Multi Vitamins', 'Ayurveda', 'High Protein Oats', 'Muesli', 
    'Protein Bars', 'Activewear', 'Accessories'
  ]),
  validationRules.optionalString('size', 50),
  body('flavours')
    .optional()
    .isArray()
    .withMessage('Flavours must be an array')
    .custom((flavours) => {
      if (flavours && flavours.length > 0) {
        for (const flavour of flavours) {
          if (typeof flavour !== 'string' || flavour.trim().length === 0) {
            throw new Error('Each flavour must be a non-empty string');
          }
          if (flavour.length > 50) {
            throw new Error('Each flavour name cannot exceed 50 characters');
          }
        }
      }
      return true;
    }),
  body('stockQuantity')
    .isInt({ min: 0 })
    .withMessage('Stock quantity must be a non-negative integer'),
  body('price')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be greater than 0'),
  handleValidationErrors
];

/**
 * Product update validation
 */
const validateProductUpdate = [
  validationRules.mongoId(),
  validationRules.optionalString('name', 100),
  validationRules.optionalString('description', 1000),
  body('price').optional().isFloat({ min: 0.01 }).withMessage('Price must be greater than 0'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  validationRules.enum('category', ['Cardio', 'Strength', 'Flexibility', 'Sports', 'Accessories']).optional(),
  validationRules.optionalString('brand', 50),
  handleValidationErrors
];

/**
 * Cart item validation
 */
const validateCartItem = [
  validationRules.mongoId('productId'),
  validationRules.positiveInteger('quantity'),
  body('variant').optional().isString().withMessage('Variant must be a string'),
  handleValidationErrors
];

/**
 * Order creation validation
 */
const validateOrderCreation = [
  body('shippingAddress').isObject().withMessage('Shipping address is required'),
  body('shippingAddress.street').notEmpty().withMessage('Street address is required'),
  body('shippingAddress.city').notEmpty().withMessage('City is required'),
  body('shippingAddress.state').notEmpty().withMessage('State is required'),
  body('shippingAddress.zipCode').notEmpty().withMessage('Zip code is required'),
  body('shippingAddress.country').notEmpty().withMessage('Country is required'),
  handleValidationErrors
];

/**
 * User profile update validation
 */
const validateProfileUpdate = [
  validationRules.name('firstName').optional(),
  validationRules.name('lastName').optional(),
  validationRules.phone('phone'),
  body('addresses').optional().isArray().withMessage('Addresses must be an array'),
  handleValidationErrors
];

/**
 * Address validation
 */
const validateAddress = [
  validationRules.requiredString('street', 5, 100),
  validationRules.requiredString('city', 2, 50),
  validationRules.requiredString('state', 2, 50),
  validationRules.requiredString('zipCode', 5, 10),
  validationRules.requiredString('country', 2, 50),
  validationRules.boolean('isDefault').optional(),
  handleValidationErrors
];

/**
 * Search and filter validation
 */
const validateSearch = [
  query('search').optional().isString().withMessage('Search query must be a string'),
  query('category').optional().isIn([
    'Pre Workout', 'Post Workout', 'Protein', 'Vegan Protein', 
    'Multi Vitamins', 'Ayurveda', 'High Protein Oats', 'Muesli', 
    'Protein Bars', 'Activewear', 'Accessories'
  ]),
  query('brandName').optional().isString().withMessage('Brand name must be a string'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Minimum price must be non-negative'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Maximum price must be non-negative'),
  query('inStock').optional().isIn(['true', 'false']).withMessage('inStock must be true or false'),
  query('sort').optional().isIn(['name', 'price', 'createdAt', 'stockQuantity', 'brandName']).withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
  ...validationRules.pagination(),
  handleValidationErrors
];

/**
 * Role assignment validation
 */
const validateRoleAssignment = [
  validationRules.mongoId('userId'),
  validationRules.mongoId('roleId'),
  handleValidationErrors
];

/**
 * Generic MongoDB ID validation for params
 */
const validateMongoId = [
  validationRules.mongoId(),
  handleValidationErrors
];

/**
 * Order status update validation
 */
const validateOrderStatusUpdate = [
  validationRules.mongoId(),
  validationRules.enum('status', ['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  handleValidationErrors
];

module.exports = {
  validationRules,
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateProductCreation,
  validateProductUpdate,
  validateCartItem,
  validateOrderCreation,
  validateProfileUpdate,
  validateAddress,
  validateSearch,
  validateRoleAssignment,
  validateMongoId,
  validateOrderStatusUpdate
};