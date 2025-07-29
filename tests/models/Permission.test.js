const mongoose = require('mongoose');
const Permission = require('../../models/Permission');
const Module = require('../../models/Module');
require('../setup');

describe('Permission Model', () => {
  let testModule;

  beforeEach(async () => {
    testModule = await new Module({
      name: 'test-module',
      description: 'Test module for permissions'
    }).save();
  });

  describe('Schema Validation', () => {
    it('should create a valid permission with required fields', async () => {
      const permissionData = {
        name: 'test_create',
        description: 'Create permission for test module',
        module: testModule._id,
        action: 'create'
      };

      const permission = new Permission(permissionData);
      const savedPermission = await permission.save();

      expect(savedPermission._id).toBeDefined();
      expect(savedPermission.name).toBe('test_create');
      expect(savedPermission.description).toBe(permissionData.description);
      expect(savedPermission.module).toEqual(testModule._id);
      expect(savedPermission.action).toBe('create');
      expect(savedPermission.createdAt).toBeDefined();
      expect(savedPermission.updatedAt).toBeDefined();
    });

    it('should auto-generate name when name is missing', async () => {
      const permission = new Permission({
        description: 'Test description',
        module: testModule._id,
        action: 'read'
      });

      const savedPermission = await permission.save();
      expect(savedPermission.name).toBe('test-module_read');
    });

    it('should fail validation when description is missing', async () => {
      const permission = new Permission({
        name: 'test_permission',
        module: testModule._id,
        action: 'read'
      });

      await expect(permission.save()).rejects.toThrow('Permission description is required');
    });

    it('should fail validation when module is missing', async () => {
      const permission = new Permission({
        name: 'test_permission',
        description: 'Test description',
        action: 'read'
      });

      await expect(permission.save()).rejects.toThrow('Permission must be associated with a module');
    });

    it('should fail validation when action is missing', async () => {
      const permission = new Permission({
        name: 'test_permission',
        description: 'Test description',
        module: testModule._id
      });

      await expect(permission.save()).rejects.toThrow('Permission action is required');
    });

    it('should fail validation with invalid action', async () => {
      const permission = new Permission({
        name: 'test_permission',
        description: 'Test description',
        module: testModule._id,
        action: 'invalid_action'
      });

      await expect(permission.save()).rejects.toThrow('Action must be one of: create, read, update, delete');
    });

    it('should accept valid actions', async () => {
      const validActions = ['create', 'read', 'update', 'delete'];

      for (const action of validActions) {
        const permission = new Permission({
          name: `test_${action}`,
          description: `Test ${action} permission`,
          module: testModule._id,
          action: action
        });

        const savedPermission = await permission.save();
        expect(savedPermission.action).toBe(action);
      }
    });

    it('should fail validation when name is too short', async () => {
      const permission = new Permission({
        name: 'a',
        description: 'Test description',
        module: testModule._id,
        action: 'read'
      });

      await expect(permission.save()).rejects.toThrow('Permission name must be at least 2 characters long');
    });

    it('should fail validation when name is too long', async () => {
      const permission = new Permission({
        name: 'a'.repeat(101),
        description: 'Test description',
        module: testModule._id,
        action: 'read'
      });

      await expect(permission.save()).rejects.toThrow('Permission name cannot exceed 100 characters');
    });

    it('should fail validation when description is too long', async () => {
      const permission = new Permission({
        name: 'test_permission',
        description: 'a'.repeat(201),
        module: testModule._id,
        action: 'read'
      });

      await expect(permission.save()).rejects.toThrow('Permission description cannot exceed 200 characters');
    });

    it('should enforce unique name constraint', async () => {
      const permissionData = {
        name: 'unique_permission',
        description: 'First permission',
        module: testModule._id,
        action: 'create'
      };

      await new Permission(permissionData).save();

      const duplicatePermission = new Permission({
        name: 'unique_permission',
        description: 'Second permission',
        module: testModule._id,
        action: 'read'
      });

      await expect(duplicatePermission.save()).rejects.toThrow();
    });

    it('should trim whitespace from name and description', async () => {
      const permission = new Permission({
        name: '  test_permission  ',
        description: '  Test description  ',
        module: testModule._id,
        action: 'read'
      });

      const savedPermission = await permission.save();
      expect(savedPermission.name).toBe('test_permission');
      expect(savedPermission.description).toBe('Test description');
    });
  });

  describe('Pre-save Middleware', () => {
    it('should auto-generate permission name if not provided', async () => {
      const permission = new Permission({
        description: 'Auto-generated permission',
        module: testModule._id,
        action: 'create'
      });

      const savedPermission = await permission.save();
      expect(savedPermission.name).toBe('test-module_create');
    });

    it('should not override provided permission name', async () => {
      const permission = new Permission({
        name: 'custom_name',
        description: 'Custom named permission',
        module: testModule._id,
        action: 'create'
      });

      const savedPermission = await permission.save();
      expect(savedPermission.name).toBe('custom_name');
    });
  });

  describe('Instance Methods', () => {
    it('should populate module with getWithModule method', async () => {
      const permission = new Permission({
        name: 'test_permission',
        description: 'Test permission',
        module: testModule._id,
        action: 'read'
      });

      const savedPermission = await permission.save();
      const permissionWithModule = await savedPermission.getWithModule();
      
      expect(permissionWithModule.module).toBeDefined();
      expect(permissionWithModule.module.name).toBe('test-module');
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      await new Permission({
        name: 'test_create',
        description: 'Create permission',
        module: testModule._id,
        action: 'create'
      }).save();

      await new Permission({
        name: 'test_read',
        description: 'Read permission',
        module: testModule._id,
        action: 'read'
      }).save();
    });

    it('should find permissions by module using findByModule method', async () => {
      const permissions = await Permission.findByModule(testModule._id);
      
      expect(permissions).toHaveLength(2);
      expect(permissions[0].module.name).toBe('test-module');
      expect(permissions[1].module.name).toBe('test-module');
    });

    it('should find permission by name using findByName method', async () => {
      const permission = await Permission.findByName('test_create');
      
      expect(permission).toBeDefined();
      expect(permission.name).toBe('test_create');
      expect(permission.module.name).toBe('test-module');
    });

    it('should find permission by name case-insensitively', async () => {
      const permission = await Permission.findByName('TEST_CREATE');
      
      expect(permission).toBeDefined();
      expect(permission.name).toBe('test_create');
    });

    it('should find permissions by action using findByAction method', async () => {
      const createPermissions = await Permission.findByAction('create');
      
      expect(createPermissions).toHaveLength(1);
      expect(createPermissions[0].action).toBe('create');
      expect(createPermissions[0].module.name).toBe('test-module');
    });

    it('should return empty array when no permissions found for action', async () => {
      const permissions = await Permission.findByAction('delete');
      expect(permissions).toHaveLength(0);
    });

    it('should return null when permission not found by name', async () => {
      const permission = await Permission.findByName('non_existent');
      expect(permission).toBeNull();
    });
  });

  describe('Virtual Properties', () => {
    it('should have roles virtual property', () => {
      const permission = new Permission({
        name: 'test_permission',
        description: 'Test permission',
        module: testModule._id,
        action: 'read'
      });

      expect(permission.schema.virtuals.roles).toBeDefined();
    });
  });

  describe('Indexes', () => {
    it('should have compound index on module and action', () => {
      const indexes = Permission.schema.indexes();
      const compoundIndex = indexes.find(index => 
        index[0].module === 1 && index[0].action === 1
      );
      expect(compoundIndex).toBeDefined();
    });

    it('should have index on name field', () => {
      const indexes = Permission.schema.indexes();
      const nameIndex = indexes.find(index => index[0].name === 1);
      expect(nameIndex).toBeDefined();
    });
  });
});