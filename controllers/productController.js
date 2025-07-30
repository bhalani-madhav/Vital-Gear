const Product = require("../models/Product");
const CONSTANTS = require("../config/constants");
const { deleteImage, extractPublicId } = require("../config/cloudinary");
const {
  sendSuccess,
  sendError,
  sendNotFound,
  sendCreated,
  sendPaginatedResponse,
} = require("../utils/responseHandler");

/**
 * Get all products with filtering and pagination
 * @route GET /api/products
 * @access Public
 */
const getAllProducts = async (req, res) => {
  try {
    const {
      page = CONSTANTS.PAGINATION.DEFAULT_PAGE,
      limit = CONSTANTS.PAGINATION.DEFAULT_LIMIT,
      category,
      brandName,
      minPrice,
      maxPrice,
      inStock,
      search,
      sort = "createdAt",
      order = "desc",
    } = req.query;

    // Build filter object
    const filter = { isActive: true };

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Brand filter
    if (brandName) {
      filter.brandName = new RegExp(brandName, "i");
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Stock filter
    if (inStock === "true") {
      filter.stockQuantity = { $gt: 0 };
    } else if (inStock === "false") {
      filter.stockQuantity = { $eq: 0 };
    }

    // Search filter (text search across name, description, brandName)
    if (search) {
      filter.$text = { $search: search };
    }   
 // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(
      CONSTANTS.PAGINATION.MAX_LIMIT,
      Math.max(1, parseInt(limit))
    );
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOrder = order === "asc" ? 1 : -1;
    const sortOptions = { [sort]: sortOrder };

    // Execute query with pagination
    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .select("-__v")
        .lean(),
      Product.countDocuments(filter),
    ]);

    // Add computed fields
    const productsWithComputedFields = products.map((product) => ({
      ...product,
      isAvailable: product.isActive && product.stockQuantity > 0,
      variantCount: 1 * (product.flavours?.length || 1),
    }));

    const pagination = {
      page: pageNum,
      limit: limitNum,
      total,
    };

    return sendPaginatedResponse(
      res,
      productsWithComputedFields,
      pagination,
      "Products retrieved successfully"
    );
  } catch (error) {
    console.error("Error in getAllProducts:", error);
    return sendError(
      res,
      "Failed to retrieve products",
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { code: CONSTANTS.ERROR_CODES.INTERNAL_ERROR }
    );
  }
};/**
 * 
Get product by ID with full information
 * @route GET /api/products/:id
 * @access Public
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).select("-__v").lean();

    if (!product) {
      return sendNotFound(res, "Product not found");
    }

    // Check if product is active
    if (!product.isActive) {
      return sendNotFound(res, "Product not available");
    }

    // Add computed fields
    const productWithComputedFields = {
      ...product,
      isAvailable: product.isActive && product.stockQuantity > 0,
      variantCount: 1 * (product.flavours?.length || 1),
      hasVariants: !!(
        product.flavours?.length > 0 ||
        (product.size && product.size.trim().length > 0)
      ),
    };

    return sendSuccess(
      res,
      productWithComputedFields,
      "Product retrieved successfully"
    );
  } catch (error) {
    console.error("Error in getProductById:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return sendError(
        res,
        "Invalid product ID format",
        CONSTANTS.HTTP_STATUS.BAD_REQUEST,
        { code: CONSTANTS.ERROR_CODES.VALIDATION_ERROR }
      );
    }

    return sendError(
      res,
      "Failed to retrieve product",
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { code: CONSTANTS.ERROR_CODES.INTERNAL_ERROR }
    );
  }
};/**
 * Cr
eate new product (Admin only)
 * @route POST /api/products
 * @access Private (Admin)
 */
const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      brandName,
      category,
      size,
      flavours,
      stockQuantity,
      price,
    } = req.body;

    // Parse flavours if it's a string (from form data)
    let parsedFlavours = [];
    if (flavours) {
      try {
        parsedFlavours = typeof flavours === 'string' ? JSON.parse(flavours) : flavours;
      } catch (error) {
        parsedFlavours = Array.isArray(flavours) ? flavours : [flavours];
      }
    }

    // Check if product with same name and brand already exists
    const existingProduct = await Product.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      brandName: { $regex: new RegExp(`^${brandName}$`, "i") },
    });

    if (existingProduct) {
      // If product creation fails, clean up uploaded images
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            await deleteImage(file.public_id);
          } catch (cleanupError) {
            console.error('Error cleaning up uploaded image:', cleanupError);
          }
        }
      }

      return sendError(
        res,
        "Product with this name and brand already exists",
        CONSTANTS.HTTP_STATUS.CONFLICT,
        { code: CONSTANTS.ERROR_CODES.DUPLICATE_ERROR }
      );
    }

    // Get image URLs from uploaded files
    const imageUrls = req.files ? req.files.map(file => file.path) : [];

    // Create new product
    const product = new Product({
      name: name.trim(),
      description: description.trim(),
      brandName: brandName.trim(),
      category,
      size: size?.trim(),
      flavours: parsedFlavours?.filter((f) => f && f.trim()).map((f) => f.trim()) || [],
      stockQuantity: parseInt(stockQuantity),
      price: parseFloat(price),
      images: imageUrls,
      isActive: true,
    });

    const savedProduct = await product.save();

    // Return product without internal fields
    const productResponse = savedProduct.toObject();
    delete productResponse.__v;

    return sendCreated(res, productResponse, "Product created successfully");
  } catch (error) {
    console.error("Error in createProduct:", error);

    // If product creation fails, clean up uploaded images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          await deleteImage(file.public_id);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded image:', cleanupError);
        }
      }
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));

      return sendError(
        res,
        "Product validation failed",
        CONSTANTS.HTTP_STATUS.BAD_REQUEST,
        {
          code: CONSTANTS.ERROR_CODES.VALIDATION_ERROR,
          details: validationErrors,
        }
      );
    }

    return sendError(
      res,
      "Failed to create product",
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { code: CONSTANTS.ERROR_CODES.INTERNAL_ERROR }
    );
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
};