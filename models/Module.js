const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Module name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Module name must be at least 2 characters long'],
    maxlength: [50, 'Module name cannot exceed 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Module description is required'],
    trim: true,
    maxlength: [200, 'Module description cannot exceed 200 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index is already created by unique: true

// Virtual to get permissions associated with this module
moduleSchema.virtual('permissions', {
  ref: 'Permission',
  localField: '_id',
  foreignField: 'module'
});

// Instance method to get module with permissions
moduleSchema.methods.getWithPermissions = function() {
  return this.populate('permissions');
};

// Static method to find module by name
moduleSchema.statics.findByName = function(name) {
  return this.findOne({ name: new RegExp(name, 'i') });
};

// Pre-save middleware to ensure name is lowercase
moduleSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.name = this.name.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('Module', moduleSchema);