const mongoose = require('mongoose');
const CONSTANTS = require('../config/constants');

// Order item subdocument schema
const orderItemSchema = new mongoose.Schema({
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
  priceAtOrderTime: {
    type: Number,
    required: [true, 'Price at order time is required'],
    min: [0, 'Price cannot be negative'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Price must be a valid positive number'
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
  }
}, {
  timestamps: false
});

// Shipping address subdocument schema (embedded copy from user's address)
const shippingAddressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home'
  },
  street: {
    type: String,
    required: [true, 'Street address is required'],
    trim: true,
    maxlength: [100, 'Street address cannot exceed 100 characters']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    maxlength: [50, 'City name cannot exceed 50 characters']
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    maxlength: [50, 'State name cannot exceed 50 characters']
  },
  zipCode: {
    type: String,
    required: [true, 'ZIP code is required'],
    trim: true,
    match: [/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code']
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true,
    default: 'United States',
    maxlength: [50, 'Country name cannot exceed 50 characters']
  }
}, {
  timestamps: false
});

// Order schema
const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  orderItems: {
    type: [orderItemSchema],
    required: [true, 'Order must have at least one item'],
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'Order must contain at least one item'
    }
  },
  shippingAddress: {
    type: shippingAddressSchema,
    required: [true, 'Shipping address is required']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative'],
    validate: {
      validator: function(value) {
        return Number.isFinite(value) && value >= 0;
      },
      message: 'Total amount must be a valid positive number'
    }
  },
  status: {
    type: String,
    required: [true, 'Order status is required'],
    enum: {
      values: Object.values(CONSTANTS.ORDER_STATUS),
      message: 'Status must be one of: {VALUE}'
    },
    default: CONSTANTS.ORDER_STATUS.PENDING
  },
  paymentMethod: {
    type: String,
    trim: true,
    maxlength: [50, 'Payment method cannot exceed 50 characters']
  },
  orderDate: {
    type: Date,
    default: Date.now,
    required: [true, 'Order date is required']
  },
  statusHistory: [{
    status: {
      type: String,
      enum: Object.values(CONSTANTS.ORDER_STATUS),
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Status note cannot exceed 500 characters']
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ 'orderItems.product': 1 });
orderSchema.index({ totalAmount: 1 });

// Compound indexes for common query patterns
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ user: 1, orderDate: -1 });
orderSchema.index({ status: 1, orderDate: -1 });

// Virtual for order number (formatted order ID)
orderSchema.virtual('orderNumber').get(function() {
  return `VG-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Virtual for total items count
orderSchema.virtual('totalItems').get(function() {
  return this.orderItems.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for current status info
orderSchema.virtual('currentStatusInfo').get(function() {
  const latestStatus = this.statusHistory[this.statusHistory.length - 1];
  return latestStatus || {
    status: this.status,
    timestamp: this.orderDate,
    note: 'Order created'
  };
});

// Virtual for formatted shipping address
orderSchema.virtual('formattedShippingAddress').get(function() {
  const addr = this.shippingAddress;
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}, ${addr.country}`;
});

// Instance method to update order status
orderSchema.methods.updateStatus = function(newStatus, note = '') {
  // Validate status transition
  const validTransitions = this.getValidStatusTransitions();
  if (!validTransitions.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
  }

  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note.trim()
  });

  return this.save();
};

// Instance method to get valid status transitions
orderSchema.methods.getValidStatusTransitions = function() {
  const transitions = {
    [CONSTANTS.ORDER_STATUS.PENDING]: [
      CONSTANTS.ORDER_STATUS.PROCESSING,
      CONSTANTS.ORDER_STATUS.CANCELLED
    ],
    [CONSTANTS.ORDER_STATUS.PROCESSING]: [
      CONSTANTS.ORDER_STATUS.SHIPPED,
      CONSTANTS.ORDER_STATUS.CANCELLED
    ],
    [CONSTANTS.ORDER_STATUS.SHIPPED]: [
      CONSTANTS.ORDER_STATUS.DELIVERED
    ],
    [CONSTANTS.ORDER_STATUS.DELIVERED]: [],
    [CONSTANTS.ORDER_STATUS.CANCELLED]: []
  };

  return transitions[this.status] || [];
};

// Instance method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return [
    CONSTANTS.ORDER_STATUS.PENDING,
    CONSTANTS.ORDER_STATUS.PROCESSING
  ].includes(this.status);
};

// Instance method to calculate order totals
orderSchema.methods.calculateTotals = function() {
  const subtotal = this.orderItems.reduce((total, item) => {
    return total + (item.priceAtOrderTime * item.quantity);
  }, 0);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalItems: this.totalItems,
    itemCount: this.orderItems.length
  };
};

// Instance method to get order summary
orderSchema.methods.getOrderSummary = function() {
  return {
    orderNumber: this.orderNumber,
    status: this.status,
    orderDate: this.orderDate,
    totalAmount: this.totalAmount,
    totalItems: this.totalItems,
    itemCount: this.orderItems.length,
    shippingAddress: this.formattedShippingAddress
  };
};

// Static method to create order from cart
orderSchema.statics.createFromCart = async function(userId, cart, shippingAddress, paymentMethod = '') {
  // Validate cart items and calculate total
  const validation = await cart.validateItems();
  if (!validation.isValid) {
    throw new Error('Cart contains invalid items');
  }

  if (cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  // Populate cart items with product details
  await cart.populate('items.product');

  // Create order items with current prices
  const orderItems = cart.items.map(item => ({
    product: item.product._id,
    quantity: item.quantity,
    priceAtOrderTime: item.product.price,
    variant: item.variant
  }));

  // Calculate total amount
  const totalAmount = cart.items.reduce((total, item) => {
    return total + (item.product.price * item.quantity);
  }, 0);

  // Create order
  const order = new this({
    user: userId,
    orderItems,
    shippingAddress,
    totalAmount: Math.round(totalAmount * 100) / 100,
    paymentMethod,
    statusHistory: [{
      status: CONSTANTS.ORDER_STATUS.PENDING,
      timestamp: new Date(),
      note: 'Order created'
    }]
  });

  return order.save();
};

// Static method to find orders by user
orderSchema.statics.findByUser = function(userId, options = {}) {
  const query = this.find({ user: userId });
  
  if (options.status) {
    query.where({ status: options.status });
  }
  
  if (options.populate) {
    query.populate('orderItems.product');
  }
  
  return query.sort({ orderDate: -1 });
};

// Static method to find orders by status
orderSchema.statics.findByStatus = function(status, options = {}) {
  const query = this.find({ status });
  
  if (options.populate) {
    query.populate('user orderItems.product');
  }
  
  return query.sort({ orderDate: -1 });
};

// Pre-save middleware to ensure status history
orderSchema.pre('save', function(next) {
  // Ensure price has at most 2 decimal places
  if (this.totalAmount) {
    this.totalAmount = Math.round(this.totalAmount * 100) / 100;
  }

  // Ensure order items have proper pricing
  this.orderItems.forEach(item => {
    if (item.priceAtOrderTime) {
      item.priceAtOrderTime = Math.round(item.priceAtOrderTime * 100) / 100;
    }
  });

  // Initialize status history if empty
  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({
      status: this.status,
      timestamp: this.orderDate || new Date(),
      note: 'Order created'
    });
  }

  next();
});

// Pre-save middleware to update product stock quantities
orderSchema.pre('save', async function(next) {
  // Only update stock on new orders
  if (this.isNew) {
    try {
      const Product = mongoose.model('Product');
      
      // Update stock for each order item
      for (const item of this.orderItems) {
        const product = await Product.findById(item.product);
        if (product) {
          await product.updateStock(item.quantity, 'subtract');
        }
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);