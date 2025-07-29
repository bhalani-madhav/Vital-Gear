const mongoose = require('mongoose');
const CONSTANTS = require('../config/constants');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
    maxlength: [2000, 'Product description cannot exceed 2000 characters']
  },
  brandName: {
    type: String,
    required: [true, 'Brand name is required'],
    trim: true,
    maxlength: [100, 'Brand name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Product category is required'],
    enum: {
      values: Object.values(CONSTANTS.PRODUCT_CATEGORIES),
      message: 'Category must be one of: {VALUE}'
    }
  },
  size: {
    type: String,
    trim: true,
    maxlength: [50, 'Size cannot exceed 50 characters']
  },
  flavours: [{
    type: String,
    trim: true,
    maxlength: [50, 'Flavour name cannot exceed 50 characters']
  }],
  stockQuantity: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock quantity cannot be negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Stock quantity must be a whole number'
    }
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Price must be a valid positive number'
    }
  },
  images: [{
    type: String,
    trim: true,
    validate: {
      validator: function(url) {
        // Skip validation for empty strings (they will be filtered out in pre-save)
        if (!url || !url.trim()) return true;
        // Basic URL validation
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        return urlPattern.test(url);
      },
      message: 'Invalid image URL format'
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
ProductSchema.index({ name: 'text', description: 'text', brandName: 'text' });
ProductSchema.index({ category: 1 });
ProductSchema.index({ brandName: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ stockQuantity: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ createdAt: -1 });

// Compound indexes for common query patterns
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ category: 1, price: 1 });
ProductSchema.index({ brandName: 1, category: 1 });

// Virtual for availability status
ProductSchema.virtual('isAvailable').get(function() {
  return this.isActive && this.stockQuantity > 0;
});

// Virtual for variant count
ProductSchema.virtual('variantCount').get(function() {
  let count = 1; // Base product
  if (this.flavours && this.flavours.length > 0) {
    count *= this.flavours.length;
  }
  return count;
});

// Instance method to check if product has variants
ProductSchema.methods.hasVariants = function() {
  const hasFlavours = !!(this.flavours && this.flavours.length > 0);
  const hasSize = !!(this.size && typeof this.size === 'string' && this.size.trim().length > 0);
  return hasFlavours || hasSize;
};

// Instance method to validate variant
ProductSchema.methods.isValidVariant = function(variant) {
  if (!variant) return !this.hasVariants();
  
  // Check flavour variant
  if (variant.flavour) {
    if (!this.flavours || !this.flavours.includes(variant.flavour)) {
      return false;
    }
  }
  
  // Check size variant
  if (variant.size) {
    if (!this.size || this.size !== variant.size) {
      return false;
    }
  }
  
  return true;
};

// Instance method to update stock
ProductSchema.methods.updateStock = function(quantity, operation = 'subtract') {
  if (operation === 'subtract') {
    if (this.stockQuantity < quantity) {
      throw new Error('Insufficient stock available');
    }
    this.stockQuantity -= quantity;
  } else if (operation === 'add') {
    this.stockQuantity += quantity;
  }
  return this.save();
};

// Static method to find available products
ProductSchema.statics.findAvailable = function(filters = {}) {
  return this.find({
    ...filters,
    isActive: true,
    stockQuantity: { $gt: 0 }
  });
};

// Static method to find by category
ProductSchema.statics.findByCategory = function(category, filters = {}) {
  return this.find({
    category,
    ...filters,
    isActive: true
  });
};

// Pre-save middleware for validation
ProductSchema.pre('save', function(next) {
  // Ensure price has at most 2 decimal places
  if (this.price) {
    this.price = Math.round(this.price * 100) / 100;
  }
  
  // Remove empty strings from flavours array
  if (this.flavours) {
    this.flavours = this.flavours.filter(flavour => flavour && flavour.trim());
  }
  
  // Remove empty strings from images array
  if (this.images) {
    this.images = this.images.filter(image => image && image.trim());
  }
  
  next();
});

module.exports = mongoose.model('Product', ProductSchema);