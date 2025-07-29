const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const Module = require('../models/Module');

/**
 * Cache for storing user permissions to improve performance
 */
const permissionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear expired cache entries
 */
const clearExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of permissionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      permissionCache.delete(key);
    }
  }
};

/**
 * Get user permissions with caching
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of permission objects
 */
const getUserPermissions = async (userId) => {
  const cacheKey = `user_permissions_${userId}`;
  const cached = permissionCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.permissions;
  }
  
  try {
    const user = await User.findById(userId).populate({
      path: 'role',
      populate: {
        path: 'permissions',
        populate: {
          path: 'module',
          model: 'Module'
        }
      }
    });
    
    if (!user || !user.role) {
      return [];
    }
    
    const permissions = user.role.permissions || [];
    
    // Cache the permissions
    permissionCache.set(cacheKey, {
      permissions,
      timestamp: Date.now()
    });
    
    // Clean up expired cache entries periodically
    if (Math.random() < 0.1) { // 10% chance to clean up
      clearExpiredCache();
    }
    
    return permissions;
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
};

/**
 * Check if user has specific permission
 * @param {string} userId - User ID
 * @param {string} permissionName - Permission name to check
 * @returns {Promise<boolean>} True if user has permission
 */
const hasPermission = async (userId, permissionName) => {
  try {
    const permissions = await getUserPermissions(userId);
    return permissions.some(permission => 
      permission.name.toLowerCase() === permissionName.toLowerCase()
    );
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
};

/**
 * Check if user has permission for specific module and action
 * @param {string} userId - User ID
 * @param {string} moduleName - Module name
 * @param {string} action - Action (create, read, update, delete)
 * @returns {Promise<boolean>} True if user has permission
 */
const hasModulePermission = async (userId, moduleName, action) => {
  try {
    const permissions = await getUserPermissions(userId);
    return permissions.some(permission => 
      permission.module && 
      permission.module.name.toLowerCase() === moduleName.toLowerCase() &&
      permission.action.toLowerCase() === action.toLowerCase()
    );
  } catch (error) {
    console.error('Error checking module permission:', error);
    return false;
  }
};

/**
 * Check if user has any of the specified permissions
 * @param {string} userId - User ID
 * @param {Array<string>} permissionNames - Array of permission names
 * @returns {Promise<boolean>} True if user has any of the permissions
 */
const hasAnyPermission = async (userId, permissionNames) => {
  try {
    const permissions = await getUserPermissions(userId);
    const userPermissionNames = permissions.map(p => p.name.toLowerCase());
    
    return permissionNames.some(permissionName => 
      userPermissionNames.includes(permissionName.toLowerCase())
    );
  } catch (error) {
    console.error('Error checking any permission:', error);
    return false;
  }
};

/**
 * Check if user has all of the specified permissions
 * @param {string} userId - User ID
 * @param {Array<string>} permissionNames - Array of permission names
 * @returns {Promise<boolean>} True if user has all permissions
 */
const hasAllPermissions = async (userId, permissionNames) => {
  try {
    const permissions = await getUserPermissions(userId);
    const userPermissionNames = permissions.map(p => p.name.toLowerCase());
    
    return permissionNames.every(permissionName => 
      userPermissionNames.includes(permissionName.toLowerCase())
    );
  } catch (error) {
    console.error('Error checking all permissions:', error);
    return false;
  }
};

/**
 * Middleware to check if user has specific permission
 * @param {string} permissionName - Required permission name
 * @returns {Function} Express middleware function
 */
const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          }
        });
      }
      
      const hasRequiredPermission = await hasPermission(req.user.id, permissionName);
      
      if (!hasRequiredPermission) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            details: {
              required: permissionName
            }
          }
        });
      }
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error during permission check',
          code: 'PERMISSION_CHECK_ERROR'
        }
      });
    }
  };
};

/**
 * Middleware to check if user has permission for specific module and action
 * @param {string} moduleName - Module name
 * @param {string} action - Action (create, read, update, delete)
 * @returns {Function} Express middleware function
 */
const requireModulePermission = (moduleName, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          }
        });
      }
      
      const hasRequiredPermission = await hasModulePermission(req.user.id, moduleName, action);
      
      if (!hasRequiredPermission) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            details: {
              required: {
                module: moduleName,
                action: action
              }
            }
          }
        });
      }
      
      next();
    } catch (error) {
      console.error('Module permission check error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error during permission check',
          code: 'PERMISSION_CHECK_ERROR'
        }
      });
    }
  };
};

/**
 * Middleware to check if user has any of the specified permissions
 * @param {Array<string>} permissionNames - Array of permission names
 * @returns {Function} Express middleware function
 */
const requireAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          }
        });
      }
      
      const hasRequiredPermission = await hasAnyPermission(req.user.id, permissionNames);
      
      if (!hasRequiredPermission) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            details: {
              required: permissionNames,
              type: 'any'
            }
          }
        });
      }
      
      next();
    } catch (error) {
      console.error('Any permission check error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error during permission check',
          code: 'PERMISSION_CHECK_ERROR'
        }
      });
    }
  };
};

/**
 * Middleware to check if user has all of the specified permissions
 * @param {Array<string>} permissionNames - Array of permission names
 * @returns {Function} Express middleware function
 */
const requireAllPermissions = (permissionNames) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          }
        });
      }
      
      const hasRequiredPermissions = await hasAllPermissions(req.user.id, permissionNames);
      
      if (!hasRequiredPermissions) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            details: {
              required: permissionNames,
              type: 'all'
            }
          }
        });
      }
      
      next();
    } catch (error) {
      console.error('All permissions check error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error during permission check',
          code: 'PERMISSION_CHECK_ERROR'
        }
      });
    }
  };
};

/**
 * Middleware to check if user has specific role
 * @param {string|Array<string>} roleNames - Role name(s) to check
 * @returns {Function} Express middleware function
 */
const requireRole = (roleNames) => {
  const roles = Array.isArray(roleNames) ? roleNames : [roleNames];
  
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED'
          }
        });
      }
      
      const user = await User.findById(req.user.id).populate('role');
      
      if (!user || !user.role) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'User role not found',
            code: 'ROLE_NOT_FOUND'
          }
        });
      }
      
      const hasRequiredRole = roles.some(roleName => 
        user.role.name.toLowerCase() === roleName.toLowerCase()
      );
      
      if (!hasRequiredRole) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Insufficient role permissions',
            code: 'INSUFFICIENT_ROLE',
            details: {
              required: roles,
              current: user.role.name
            }
          }
        });
      }
      
      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error during role check',
          code: 'ROLE_CHECK_ERROR'
        }
      });
    }
  };
};

/**
 * Clear permission cache for a specific user
 * @param {string} userId - User ID
 */
const clearUserPermissionCache = (userId) => {
  const cacheKey = `user_permissions_${userId}`;
  permissionCache.delete(cacheKey);
};

/**
 * Clear all permission cache
 */
const clearAllPermissionCache = () => {
  permissionCache.clear();
};

module.exports = {
  // Utility functions
  getUserPermissions,
  hasPermission,
  hasModulePermission,
  hasAnyPermission,
  hasAllPermissions,
  
  // Middleware functions
  requirePermission,
  requireModulePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  
  // Cache management
  clearUserPermissionCache,
  clearAllPermissionCache
};