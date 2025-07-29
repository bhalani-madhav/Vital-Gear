const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Role name must be at least 2 characters long'],
    maxlength: [50, 'Role name cannot exceed 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Role description is required'],
    trim: true,
    maxlength: [200, 'Role description cannot exceed 200 characters']
  },
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
roleSchema.index({ name: 1 });

// Virtual to get users with this role
roleSchema.virtual('users', {
  ref: 'User',
  localField: '_id',
  foreignField: 'role'
});

// Instance method to get role with permissions populated
roleSchema.methods.getWithPermissions = function() {
  return this.populate({
    path: 'permissions',
    populate: {
      path: 'module',
      model: 'Module'
    }
  });
};

// Instance method to check if role has specific permission
roleSchema.methods.hasPermission = function(permissionName) {
  return this.populate('permissions').then(() => {
    return this.permissions.some(permission => 
      permission.name.toLowerCase() === permissionName.toLowerCase()
    );
  });
};

// Instance method to add permission to role
roleSchema.methods.addPermission = function(permissionId) {
  if (!this.permissions.includes(permissionId)) {
    this.permissions.push(permissionId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to remove permission from role
roleSchema.methods.removePermission = function(permissionId) {
  this.permissions = this.permissions.filter(
    permission => !permission.equals(permissionId)
  );
  return this.save();
};

// Static method to find role by name
roleSchema.statics.findByName = function(name) {
  return this.findOne({ name: new RegExp(name, 'i') });
};

// Static method to get role with all permissions and modules
roleSchema.statics.findWithFullPermissions = function(roleId) {
  return this.findById(roleId).populate({
    path: 'permissions',
    populate: {
      path: 'module',
      model: 'Module'
    }
  });
};

// Pre-save middleware to ensure role name is properly formatted
roleSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    // Capitalize first letter of each word
    this.name = this.name.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }
  next();
});

module.exports = mongoose.model('Role', roleSchema);