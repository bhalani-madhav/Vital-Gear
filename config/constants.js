// Application Constants
const CONSTANTS = {
  // User Roles
  ROLES: {
    USER: 'User',
    ADMIN: 'Admin'
  },

  // Product Categories
  PRODUCT_CATEGORIES: {
    SUPPLEMENTS: 'Supplements',
    ACTIVEWEAR: 'Activewear',
    EQUIPMENT: 'Equipment',
    ACCESSORIES: 'Accessories'
  },

  // Order Status
  ORDER_STATUS: {
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled'
  },

  // RBAC Modules
  MODULES: {
    USERS: 'Users',
    PRODUCTS: 'Products',
    ORDERS: 'Orders',
    CART: 'Cart',
    ADMIN: 'Admin'
  },

  // RBAC Actions
  ACTIONS: {
    CREATE: 'create',
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete'
  },

  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500
  },

  // Error Codes
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
    DUPLICATE_ERROR: 'DUPLICATE_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
  },

  // JWT Configuration
  JWT: {
    ALGORITHM: 'HS256',
    ISSUER: 'vitalgear-api'
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100
  },

  // File Upload
  UPLOAD: {
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp']
  }
};

module.exports = CONSTANTS;