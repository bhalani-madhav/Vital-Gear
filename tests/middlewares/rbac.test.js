const mongoose = require('mongoose');
const {
  getUserPermissions,
  hasPermission,
  hasModulePermission,
  hasAnyPermission,
  hasAllPermissions,
  requirePermission,
  requireModulePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  clearUserPermissionCache,
  clearAllPermissionCache
} = require('../../middlewares/rbac');

const User = require('../../models/User');
const Role = require('../../models/Role');
const Permission = require('../../models/Permission');
const Module = require('../../models/Module');

describe('RBAC Middleware', () => {
  let testUser, testRole, testModule, testPermissions;
  let req, res, next;

  beforeEach(async () => {
    // Clear cache before each test
    clearAllPermissionCache();

    // Create test module
    testModule = await Module.create({
      name: 'products',
      description: 'Product management module'
    });

    // Create test permissions
    testPermissions = await Permission.create([
      {
        name: 'products_create',
        description: 'Create products',
        module: testModule._id,
        action: 'create'
      },
      {
        name: 'products_read',
        description: 'Read products',
        module: testModule._id,
        action: 'read'
      },
      {
        name: 'products_update',
        description: 'Update products',
        module: testModule._id,
        action: 'update'
      }
    ]);

    // Create test role
    testRole = await Role.create({
      name: 'Admin',
      description: 'Administrator role',
      permissions: testPermissions.map(p => p._id)
    });

    // Create test user
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123',
      role: testRole._id
    });

    // Mock Express request, response, and next
    req = {
      user: { id: testUser._id.toString() }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('getUserPermissions', () => {
    it('should return user permissions', async () => {
      const permissions = await getUserPermissions(testUser._id.toString());
      
      expect(permissions).toHaveLength(3);
      expect(permissions[0]).toHaveProperty('name');
      expect(permissions[0]).toHaveProperty('module');
      expect(permissions[0]).toHaveProperty('action');
    });

    it('should return empty array for user without role', async () => {
      const userWithoutRole = await User.create({
        firstName: 'No',
        lastName: 'Role',
        email: 'norole@example.com',
        password: 'password123',
        role: new mongoose.Types.ObjectId()
      });

      const permissions = await getUserPermissions(userWithoutRole._id.toString());
      expect(permissions).toEqual([]);
    });

    it('should return empty array for non-existent user', async () => {
      const permissions = await getUserPermissions(new mongoose.Types.ObjectId().toString());
      expect(permissions).toEqual([]);
    });

    it('should cache permissions for performance', async () => {
      // First call
      const permissions1 = await getUserPermissions(testUser._id.toString());
      
      // Second call should use cache
      const permissions2 = await getUserPermissions(testUser._id.toString());
      
      expect(permissions1).toEqual(permissions2);
    });
  });

  describe('hasPermission', () => {
    it('should return true for existing permission', async () => {
      const result = await hasPermission(testUser._id.toString(), 'products_create');
      expect(result).toBe(true);
    });

    it('should return false for non-existing permission', async () => {
      const result = await hasPermission(testUser._id.toString(), 'products_delete');
      expect(result).toBe(false);
    });

    it('should be case insensitive', async () => {
      const result = await hasPermission(testUser._id.toString(), 'PRODUCTS_CREATE');
      expect(result).toBe(true);
    });

    it('should return false for invalid user ID', async () => {
      const result = await hasPermission('invalid-id', 'products_create');
      expect(result).toBe(false);
    });
  });

  describe('hasModulePermission', () => {
    it('should return true for existing module permission', async () => {
      const result = await hasModulePermission(testUser._id.toString(), 'products', 'create');
      expect(result).toBe(true);
    });

    it('should return false for non-existing module permission', async () => {
      const result = await hasModulePermission(testUser._id.toString(), 'products', 'delete');
      expect(result).toBe(false);
    });

    it('should return false for non-existing module', async () => {
      const result = await hasModulePermission(testUser._id.toString(), 'orders', 'create');
      expect(result).toBe(false);
    });

    it('should be case insensitive', async () => {
      const result = await hasModulePermission(testUser._id.toString(), 'PRODUCTS', 'CREATE');
      expect(result).toBe(true);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the permissions', async () => {
      const result = await hasAnyPermission(testUser._id.toString(), ['products_create', 'orders_create']);
      expect(result).toBe(true);
    });

    it('should return false if user has none of the permissions', async () => {
      const result = await hasAnyPermission(testUser._id.toString(), ['products_delete', 'orders_create']);
      expect(result).toBe(false);
    });

    it('should return false for empty permission array', async () => {
      const result = await hasAnyPermission(testUser._id.toString(), []);
      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', async () => {
      const result = await hasAllPermissions(testUser._id.toString(), ['products_create', 'products_read']);
      expect(result).toBe(true);
    });

    it('should return false if user is missing any permission', async () => {
      const result = await hasAllPermissions(testUser._id.toString(), ['products_create', 'products_delete']);
      expect(result).toBe(false);
    });

    it('should return true for empty permission array', async () => {
      const result = await hasAllPermissions(testUser._id.toString(), []);
      expect(result).toBe(true);
    });
  });

  describe('requirePermission middleware', () => {
    it('should call next() if user has required permission', async () => {
      const middleware = requirePermission('products_create');
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user lacks required permission', async () => {
      const middleware = requirePermission('products_delete');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          details: {
            required: 'products_delete'
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', async () => {
      req.user = null;
      const middleware = requirePermission('products_create');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireModulePermission middleware', () => {
    it('should call next() if user has required module permission', async () => {
      const middleware = requireModulePermission('products', 'create');
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user lacks required module permission', async () => {
      const middleware = requireModulePermission('products', 'delete');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          details: {
            required: {
              module: 'products',
              action: 'delete'
            }
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAnyPermission middleware', () => {
    it('should call next() if user has any required permission', async () => {
      const middleware = requireAnyPermission(['products_create', 'orders_create']);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user has none of the required permissions', async () => {
      const middleware = requireAnyPermission(['products_delete', 'orders_create']);
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          details: {
            required: ['products_delete', 'orders_create'],
            type: 'any'
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAllPermissions middleware', () => {
    it('should call next() if user has all required permissions', async () => {
      const middleware = requireAllPermissions(['products_create', 'products_read']);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user is missing any required permission', async () => {
      const middleware = requireAllPermissions(['products_create', 'products_delete']);
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          details: {
            required: ['products_create', 'products_delete'],
            type: 'all'
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole middleware', () => {
    it('should call next() if user has required role', async () => {
      const middleware = requireRole('Admin');
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() if user has any of the required roles', async () => {
      const middleware = requireRole(['Admin', 'Manager']);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user lacks required role', async () => {
      const middleware = requireRole('SuperAdmin');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Insufficient role permissions',
          code: 'INSUFFICIENT_ROLE',
          details: {
            required: ['SuperAdmin'],
            current: 'Admin'
          }
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should be case insensitive', async () => {
      const middleware = requireRole('admin');
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user has no role', async () => {
      const userWithoutRole = await User.create({
        firstName: 'No',
        lastName: 'Role',
        email: 'norole2@example.com',
        password: 'password123',
        role: new mongoose.Types.ObjectId()
      });

      req.user.id = userWithoutRole._id.toString();
      const middleware = requireRole('Admin');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'User role not found',
          code: 'ROLE_NOT_FOUND'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Cache management', () => {
    it('should clear user permission cache', async () => {
      // First call to populate cache
      await getUserPermissions(testUser._id.toString());
      
      // Clear cache for specific user
      clearUserPermissionCache(testUser._id.toString());
      
      // This should work without issues
      const permissions = await getUserPermissions(testUser._id.toString());
      expect(permissions).toHaveLength(3);
    });

    it('should clear all permission cache', async () => {
      // First call to populate cache
      await getUserPermissions(testUser._id.toString());
      
      // Clear all cache
      clearAllPermissionCache();
      
      // This should work without issues
      const permissions = await getUserPermissions(testUser._id.toString());
      expect(permissions).toHaveLength(3);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully in getUserPermissions', async () => {
      // Mock a database error by using invalid ObjectId
      const permissions = await getUserPermissions('invalid-object-id');
      expect(permissions).toEqual([]);
    });

    it('should handle errors in middleware and return 500', async () => {
      // Mock User.findById to throw an error
      const originalFindById = User.findById;
      User.findById = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const middleware = requireRole('Admin');
      await middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Internal server error during role check',
          code: 'ROLE_CHECK_ERROR'
        }
      });
      expect(next).not.toHaveBeenCalled();

      // Restore original method
      User.findById = originalFindById;
    });
  });
});