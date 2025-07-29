const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    trim: true,
    minlength: [2, 'Permission name must be at least 2 characters long'],
    maxlength: [100, 'Permission name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Permission description is required'],
    trim: true,
    maxlength: [200, 'Permission description cannot exceed 200 characters']
  },
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: [true, 'Permission must be associated with a module']
  },
  action: {
    type: String,
    required: [true, 'Permission action is required'],
    enum: {
      values: ['create', 'read', 'update', 'delete'],
      message: 'Action must be one of: create, read, update, delete'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for efficient queries
permissionSchema.index({ module: 1, action: 1 });
// Name index is already created by unique: true

// Virtual to get roles that have this permission
permissionSchema.virtual('roles', {
  ref: 'Role',
  localField: '_id',
  foreignField: 'permissions'
});

// Instance method to get permission with module details
permissionSchema.methods.getWithModule = function() {
  return this.populate('module');
};

// Static method to find permissions by module
permissionSchema.statics.findByModule = function(moduleId) {
  return this.find({ module: moduleId }).populate('module');
};

// Static method to find permission by name
permissionSchema.statics.findByName = function(name) {
  return this.findOne({ name: new RegExp(name, 'i') }).populate('module');
};

// Static method to find permissions by action
permissionSchema.statics.findByAction = function(action) {
  return this.find({ action }).populate('module');
};

// Pre-save middleware to generate permission name if not provided
permissionSchema.pre('save', async function(next) {
  if (this.isNew && !this.name) {
    // Auto-generate permission name based on module and action
    const module = await mongoose.model('Module').findById(this.module);
    if (module) {
      this.name = `${module.name}_${this.action}`;
    }
  }
  
  // Validate that name is present after auto-generation
  if (!this.name) {
    return next(new Error('Permission name is required'));
  }
  
  next();
});

module.exports = mongoose.model('Permission', permissionSchema);