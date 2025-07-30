const express = require('express');
const {
  getAllProducts,
  getProductById,
  createProduct
} = require('../controllers/productController');
const {
  validateSearch,
  validateMongoId,
  validateProductCreation
} = require('../middlewares/validation');
const { authenticateToken } = require('../middlewares/auth');
const { requireModulePermission } = require('../middlewares/rbac');
const { uploadMultiple } = require('../config/cloudinary');
const CONSTANTS = require('../config/constants');

const router = express.Router();

/**
 * @route   GET /api/products
 * @desc    Get all products with filtering and pagination
 * @access  Public
 */
router.get('/', validateSearch, getAllProducts);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID with full information
 * @access  Public
 */
router.get('/:id', validateMongoId, getProductById);

/**
 * @route   POST /api/products
 * @desc    Create new product (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/',
  authenticateToken,
  requireModulePermission(CONSTANTS.MODULES.PRODUCTS, CONSTANTS.ACTIONS.CREATE),
  uploadMultiple,
  validateProductCreation,
  createProduct
);

module.exports = router;