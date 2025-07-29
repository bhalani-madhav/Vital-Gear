const mongoose = require('mongoose');

// Cart item subdocument schema
const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product reference is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be a whole number'
    }
  },
  variant: {
    flavour: {
      type: String,
      trim: true,
      maxlength: [50, 'Flavour name cannot exceed 50 characters']
    },
    size: {
      type: String,
      trim: true,
      maxlength: [50, 'Size cannot exceed 50 characters']
    }
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // We have addedAt field instead
});

// Cart schema
const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    unique: true // Each user can have only one cart
  },
  items: [cartItemSchema]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
cartSchema.index({ user: 1 });
cartSchema.index({ 'items.product': 1 });
cartSchema.index({ updatedAt: -1 });

// Virtual for total items count
cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for total amount (requires populated products)
cartSchema.virtual('totalAmount').get(function() {
  return this.items.reduce((total, item) => {
    if (item.product && item.product.price) {
      return total + (item.product.price * item.quantity);
    }
    return total;
  }, 0);
});

// Instance method to add item to cart
cartSchema.methods.addItem = async function(productId, quantity, variant = {}) {
  // Check if item with same product and variant already exists
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() &&
    JSON.stringify(item.variant) === JSON.stringify(variant)
  );

  if (existingItemIndex > -1) {
    // Update quantity of existing item
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].addedAt = new Date();
  } else {
    // Add new item
    this.items.push({
      product: productId,
      quantity,
      variant,
      addedAt: new Date()
    });
  }

  return this.save();
};

// Instance method to update item quantity
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Cart item not found');
  }

  if (quantity <= 0) {
    // Remove item if quantity is 0 or negative
    this.items.pull(itemId);
  } else {
    item.quantity = quantity;
    item.addedAt = new Date();
  }

  return this.save();
};

// Instance method to remove item from cart
cartSchema.methods.removeItem = function(itemId) {
  const item = this.items.id(itemId);
  if (!item) {
    throw new Error('Cart item not found');
  }

  this.items.pull(itemId);
  return this.save();
};

// Instance method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  return this.save();
};

// Instance method to validate cart items against product availability
cartSchema.methods.validateItems = async function() {
  await this.populate('items.product');
  
  const validationErrors = [];
  const itemsToRemove = [];

  for (let i = 0; i < this.items.length; i++) {
    const item = this.items[i];
    const product = item.product;

    // Check if product exists and is active
    if (!product || !product.isActive) {
      validationErrors.push({
        itemId: item._id,
        error: 'Product is no longer available'
      });
      itemsToRemove.push(item._id);
      continue;
    }

    // Check stock availability
    if (product.stockQuantity < item.quantity) {
      validationErrors.push({
        itemId: item._id,
        error: `Only ${product.stockQuantity} items available in stock`,
        availableQuantity: product.stockQuantity
      });
    }

    // Validate variant if product has variants
    if (product.hasVariants() && !product.isValidVariant(item.variant)) {
      validationErrors.push({
        itemId: item._id,
        error: 'Selected variant is no longer available'
      });
      itemsToRemove.push(item._id);
    }
  }

  // Remove invalid items
  if (itemsToRemove.length > 0) {
    itemsToRemove.forEach(itemId => {
      this.items.pull(itemId);
    });
    await this.save();
  }

  return {
    isValid: validationErrors.length === 0,
    errors: validationErrors,
    removedItems: itemsToRemove
  };
};

// Instance method to calculate totals with populated products
cartSchema.methods.calculateTotals = async function() {
  await this.populate('items.product');
  
  let subtotal = 0;
  let totalItems = 0;

  this.items.forEach(item => {
    if (item.product && item.product.price) {
      subtotal += item.product.price * item.quantity;
      totalItems += item.quantity;
    }
  });

  return {
    subtotal: Math.round(subtotal * 100) / 100, // Round to 2 decimal places
    totalItems,
    itemCount: this.items.length
  };
};

// Static method to find cart by user
cartSchema.statics.findByUser = function(userId) {
  return this.findOne({ user: userId }).populate('items.product');
};

// Static method to create or get cart for user
cartSchema.statics.findOrCreateByUser = async function(userId) {
  let cart = await this.findOne({ user: userId });
  
  if (!cart) {
    cart = new this({ user: userId, items: [] });
    await cart.save();
  }
  
  return cart.populate('items.product');
};

// Pre-save middleware to update timestamps
cartSchema.pre('save', function(next) {
  // Update the cart's updatedAt timestamp when items are modified
  if (this.isModified('items')) {
    this.updatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Cart', cartSchema);