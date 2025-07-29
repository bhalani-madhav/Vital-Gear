const Module = require('../../models/Module');
const Permission = require('../../models/Permission');
const Role = require('../../models/Role');
const {
  seedRBACData,
  clearRBACData,
  getSeededRole,
  validateRBACData,
  MODULES,
  PERMISSIONS,
  ROLES
} = require('../../utils/seedData');

describe('RBAC Data Seeding', () => {
  beforeEach(async () => {
    // Clear all collections before each test
    await clearRBACData();
  });

  describe('seedRBACData', () => {
    test('should seed all modules, permissions, and roles successfully', async () => {
      const result = await seedRBACData();

      expect(result).toHaveProperty('modules');
      expect(result).toHaveProperty('permissions');
      expect(result).toHaveProperty('roles');

      // Verify modules
      expect(Object.keys(result.modules)).toHaveLength(MODULES.length);
      for (const moduleData of MODULES) {
        expect(result.modules[moduleData.name]).toBeDefined();
        expect(result.modules[moduleData.name].name).toBe(moduleData.name);
        expect(result.modules[moduleData.name].description).toBe(moduleData.description);
      }

      // Verify permissions
      expect(Object.keys(result.permissions)).toHaveLength(PERMISSIONS.length);
      for (const permissionData of PERMISSIONS) {
        const permissionName = `${permissionData.module}_${permissionData.action}`;
        expect(result.permissions[permissionName]).toBeDefined();
        expect(result.permissions[permissionName].name).toBe(permissionName);
        expect(result.permissions[permissionName].action).toBe(permissionData.action);
      }

      // Verify roles
      expect(Object.keys(result.roles)).toHaveLength(ROLES.length);
      for (const roleData of ROLES) {
        expect(result.roles[roleData.name]).toBeDefined();
        expect(result.roles[roleData.name].name).toBe(roleData.name);
        expect(result.roles[roleData.name].permissions).toHaveLength(roleData.permissions.length);
      }
    });

    test('should not create duplicates when run multiple times', async () => {
      // Run seeding twice
      await seedRBACData();
      await seedRBACData();

      // Verify counts remain the same
      const moduleCount = await Module.countDocuments();
      const permissionCount = await Permission.countDocuments();
      const roleCount = await Role.countDocuments();

      expect(moduleCount).toBe(MODULES.length);
      expect(permissionCount).toBe(PERMISSIONS.length);
      expect(roleCount).toBe(ROLES.length);
    });

    test('should update role permissions if they change', async () => {
      // First seeding
      await seedRBACData();
      
      // Get initial User role
      const initialUserRole = await Role.findByName('User');
      const initialPermissionCount = initialUserRole.permissions.length;

      // Manually add a permission to test update functionality
      const adminPermission = await Permission.findByName('admin_read');
      initialUserRole.permissions.push(adminPermission._id);
      await initialUserRole.save();

      // Run seeding again - should restore original permissions
      await seedRBACData();
      
      const updatedUserRole = await Role.findByName('User');
      expect(updatedUserRole.permissions).toHaveLength(initialPermissionCount);
      
      // Verify admin permission was removed
      const hasAdminPermission = updatedUserRole.permissions.some(
        permId => permId.toString() === adminPermission._id.toString()
      );
      expect(hasAdminPermission).toBe(false);
    });
  });

  describe('clearRBACData', () => {
    test('should remove all RBAC data from database', async () => {
      // Seed data first
      await seedRBACData();
      
      // Verify data exists
      expect(await Module.countDocuments()).toBeGreaterThan(0);
      expect(await Permission.countDocuments()).toBeGreaterThan(0);
      expect(await Role.countDocuments()).toBeGreaterThan(0);

      // Clear data
      await clearRBACData();

      // Verify data is cleared
      expect(await Module.countDocuments()).toBe(0);
      expect(await Permission.countDocuments()).toBe(0);
      expect(await Role.countDocuments()).toBe(0);
    });
  });

  describe('getSeededRole', () => {
    beforeEach(async () => {
      await seedRBACData();
    });

    test('should retrieve User role with populated permissions', async () => {
      const userRole = await getSeededRole('User');

      expect(userRole).toBeDefined();
      expect(userRole.name).toBe('User');
      expect(userRole.permissions).toBeDefined();
      expect(userRole.permissions.length).toBeGreaterThan(0);

      // Verify permissions are populated
      const firstPermission = userRole.permissions[0];
      expect(firstPermission.name).toBeDefined();
      expect(firstPermission.action).toBeDefined();
      expect(firstPermission.module).toBeDefined();
      expect(firstPermission.module.name).toBeDefined();
    });

    test('should retrieve Admin role with populated permissions', async () => {
      const adminRole = await getSeededRole('Admin');

      expect(adminRole).toBeDefined();
      expect(adminRole.name).toBe('Admin');
      expect(adminRole.permissions).toBeDefined();
      expect(adminRole.permissions.length).toBeGreaterThan(0);

      // Admin should have more permissions than User
      const userRole = await getSeededRole('User');
      expect(adminRole.permissions.length).toBeGreaterThan(userRole.permissions.length);
    });

    test('should throw error for non-existent role', async () => {
      await expect(getSeededRole('NonExistentRole')).rejects.toThrow('Role not found: NonExistentRole');
    });
  });

  describe('validateRBACData', () => {
    test('should return true when all data is properly seeded', async () => {
      await seedRBACData();
      const isValid = await validateRBACData();
      expect(isValid).toBe(true);
    });

    test('should return false when modules are missing', async () => {
      await seedRBACData();
      await Module.deleteOne({ name: 'users' });
      
      const isValid = await validateRBACData();
      expect(isValid).toBe(false);
    });

    test('should return false when permissions are missing', async () => {
      await seedRBACData();
      await Permission.deleteOne({ name: 'users_read' });
      
      const isValid = await validateRBACData();
      expect(isValid).toBe(false);
    });

    test('should return false when roles are missing', async () => {
      await seedRBACData();
      await Role.deleteOne({ name: 'User' });
      
      const isValid = await validateRBACData();
      expect(isValid).toBe(false);
    });

    test('should return false when role has incorrect permissions', async () => {
      await seedRBACData();
      
      // Remove a permission from User role
      const userRole = await Role.findByName('User');
      userRole.permissions.pop();
      await userRole.save();
      
      const isValid = await validateRBACData();
      expect(isValid).toBe(false);
    });
  });

  describe('Role Permission Verification', () => {
    beforeEach(async () => {
      await seedRBACData();
    });

    test('should verify User role has correct permissions', async () => {
      const userRole = await getSeededRole('User');
      const expectedPermissions = ROLES.find(r => r.name === 'User').permissions;

      expect(userRole.permissions).toHaveLength(expectedPermissions.length);

      // Verify each expected permission exists
      for (const expectedPermission of expectedPermissions) {
        const hasPermission = userRole.permissions.some(
          permission => permission.name === expectedPermission
        );
        expect(hasPermission).toBe(true);
      }
    });

    test('should verify Admin role has correct permissions', async () => {
      const adminRole = await getSeededRole('Admin');
      const expectedPermissions = ROLES.find(r => r.name === 'Admin').permissions;

      expect(adminRole.permissions).toHaveLength(expectedPermissions.length);

      // Verify each expected permission exists
      for (const expectedPermission of expectedPermissions) {
        const hasPermission = adminRole.permissions.some(
          permission => permission.name === expectedPermission
        );
        expect(hasPermission).toBe(true);
      }
    });

    test('should verify Admin has all User permissions plus additional ones', async () => {
      const userRole = await getSeededRole('User');
      const adminRole = await getSeededRole('Admin');

      const userPermissionNames = userRole.permissions.map(p => p.name);
      const adminPermissionNames = adminRole.permissions.map(p => p.name);

      // Admin should have all user permissions
      for (const userPermission of userPermissionNames) {
        expect(adminPermissionNames).toContain(userPermission);
      }

      // Admin should have additional permissions
      expect(adminPermissionNames.length).toBeGreaterThan(userPermissionNames.length);
      
      // Verify admin has admin module permissions
      const hasAdminPermissions = adminPermissionNames.some(name => name.startsWith('admin_'));
      expect(hasAdminPermissions).toBe(true);
    });
  });

  describe('Module and Permission Relationships', () => {
    beforeEach(async () => {
      await seedRBACData();
    });

    test('should verify all permissions are linked to correct modules', async () => {
      const permissions = await Permission.find().populate('module');

      for (const permission of permissions) {
        expect(permission.module).toBeDefined();
        expect(permission.module.name).toBeDefined();
        
        // Verify permission name matches module_action pattern
        const expectedName = `${permission.module.name}_${permission.action}`;
        expect(permission.name).toBe(expectedName);
      }
    });

    test('should verify each module has expected permissions', async () => {
      const modules = await Module.find();

      for (const module of modules) {
        const modulePermissions = await Permission.find({ module: module._id });
        expect(modulePermissions.length).toBeGreaterThan(0);

        // Verify all permissions belong to this module
        for (const permission of modulePermissions) {
          expect(permission.name).toMatch(new RegExp(`^${module.name}_`));
        }
      }
    });
  });
});