const mongoose = require('mongoose');
const Role = require('../../models/Role');
const Permission = require('../../models/Permission');
const Module = require('../../models/Module');
require('../setup');

describe('Role Model', () => {
  let testModule;
  let testPermissions;

  beforeEach(async () => {
    testModule = await new Module({
      name: 'test-module',
      description: 'Test module for roles'
    }).save();

    testPermissions = await Promise.all([
      new Permission({
        name: 'test_create',
        description: 'Create permission',
        module: testModule._id,
        action: 'create'
      }).save(),
      new Permission({
        name: 'test_read',
        description: 'Read permission',
        module: testModule._id,
        action: 'read'
      }).save()
    ]);
  });

  describe('Schema Validation', () => {
    it('should create a valid role with required fields', async () => {
      const roleData = {
        name: 'test-role',
        description: 'Test role for validation',
        permissions: [testPermissions[0]._id]
      };

      const role = new Role(roleData);
      const savedRole = await role.save();

      expect(savedRole._id).toBeDefined();
      expect(savedRole.name).toBe('Test-Role');
      expect(savedRole.description).toBe(roleData.description);
      expect(savedRole.permissions).toHaveLength(1);
      expect(savedRole.permissions[0]).toEqual(testPermissions[0]._id);
      expect(savedRole.createdAt).toBeDefined();
      expect(savedRole.updatedAt).toBeDefined();
    });

    it('should create a role without permissions', async () => {
      const roleData = {
        name: 'empty-role',
        description: 'Role without permissions'
      };

      const role = new Role(roleData);
      const savedRole = await role.save();

      expect(savedRole.permissions).toHaveLength(0);
    });

    it('should fail validation when name is missing', async () => {
      const role = new Role({
        description: 'Test description'
      });

      await expect(role.save()).rejects.toThrow('Role name is required');
    });

    it('should fail validation when description is missing', async () => {
      const role = new Role({
        name: 'test-role'
      });

      await expect(role.save()).rejects.toThrow('Role description is required');
    });

    it('should fail validation when name is too short', async () => {
      const role = new Role({
        name: 'a',
        description: 'Test description'
      });

      await expect(role.save()).rejects.toThrow('Role name must be at least 2 characters long');
    });

    it('should fail validation when name is too long', async () => {
      const role = new Role({
        name: 'a'.repeat(51),
        description: 'Test description'
      });

      await expect(role.save()).rejects.toThrow('Role name cannot exceed 50 characters');
    });

    it('should fail validation when description is too long', async () => {
      const role = new Role({
        name: 'test-role',
        description: 'a'.repeat(201)
      });

      await expect(role.save()).rejects.toThrow('Role description cannot exceed 200 characters');
    });

    it('should enforce unique name constraint', async () => {
      const roleData = {
        name: 'unique-role',
        description: 'First role'
      };

      await new Role(roleData).save();

      const duplicateRole = new Role({
        name: 'unique-role',
        description: 'Second role'
      });

      await expect(duplicateRole.save()).rejects.toThrow();
    });

    it('should trim whitespace from name and description', async () => {
      const role = new Role({
        name: '  test-role  ',
        description: '  Test description  '
      });

      const savedRole = await role.save();
      expect(savedRole.name).toBe('Test-Role');
      expect(savedRole.description).toBe('Test description');
    });
  });

  describe('Pre-save Middleware', () => {
    it('should capitalize role name before saving', async () => {
      const role = new Role({
        name: 'test role name',
        description: 'Test description'
      });

      const savedRole = await role.save();
      expect(savedRole.name).toBe('Test Role Name');
    });

    it('should handle single word names', async () => {
      const role = new Role({
        name: 'admin',
        description: 'Administrator role'
      });

      const savedRole = await role.save();
      expect(savedRole.name).toBe('Admin');
    });

    it('should handle hyphenated names', async () => {
      const role = new Role({
        name: 'super-admin',
        description: 'Super administrator role'
      });

      const savedRole = await role.save();
      expect(savedRole.name).toBe('Super-Admin');
    });
  });

  describe('Instance Methods', () => {
    let testRole;

    beforeEach(async () => {
      testRole = await new Role({
        name: 'test-role',
        description: 'Test role',
        permissions: [testPermissions[0]._id, testPermissions[1]._id]
      }).save();
    });

    it('should populate permissions with getWithPermissions method', async () => {
      const roleWithPermissions = await testRole.getWithPermissions();
      
      expect(roleWithPermissions.permissions).toHaveLength(2);
      expect(roleWithPermissions.permissions[0].name).toBeDefined();
      expect(roleWithPermissions.permissions[0].module.name).toBe('test-module');
    });

    it('should check if role has specific permission with hasPermission method', async () => {
      const hasPermission = await testRole.hasPermission('test_create');
      expect(hasPermission).toBe(true);

      const hasNonExistentPermission = await testRole.hasPermission('non_existent');
      expect(hasNonExistentPermission).toBe(false);
    });

    it('should add permission to role with addPermission method', async () => {
      const newPermission = await new Permission({
        name: 'test_update',
        description: 'Update permission',
        module: testModule._id,
        action: 'update'
      }).save();

      const updatedRole = await testRole.addPermission(newPermission._id);
      
      expect(updatedRole.permissions).toHaveLength(3);
      expect(updatedRole.permissions).toContain(newPermission._id);
    });

    it('should not add duplicate permission with addPermission method', async () => {
      const originalLength = testRole.permissions.length;
      const updatedRole = await testRole.addPermission(testPermissions[0]._id);
      
      expect(updatedRole.permissions).toHaveLength(originalLength);
    });

    it('should remove permission from role with removePermission method', async () => {
      const updatedRole = await testRole.removePermission(testPermissions[0]._id);
      
      expect(updatedRole.permissions).toHaveLength(1);
      expect(updatedRole.permissions).not.toContain(testPermissions[0]._id);
      expect(updatedRole.permissions).toContain(testPermissions[1]._id);
    });

    it('should handle removing non-existent permission gracefully', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const originalLength = testRole.permissions.length;
      
      const updatedRole = await testRole.removePermission(nonExistentId);
      expect(updatedRole.permissions).toHaveLength(originalLength);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      await new Role({
        name: 'admin',
        description: 'Administrator role',
        permissions: [testPermissions[0]._id, testPermissions[1]._id]
      }).save();

      await new Role({
        name: 'user',
        description: 'Regular user role',
        permissions: [testPermissions[1]._id]
      }).save();
    });

    it('should find role by name using findByName method', async () => {
      const role = await Role.findByName('admin');
      
      expect(role).toBeDefined();
      expect(role.name).toBe('Admin');
    });

    it('should find role by name case-insensitively', async () => {
      const role = await Role.findByName('ADMIN');
      
      expect(role).toBeDefined();
      expect(role.name).toBe('Admin');
    });

    it('should return null when role not found by name', async () => {
      const role = await Role.findByName('non-existent');
      expect(role).toBeNull();
    });

    it('should find role with full permissions using findWithFullPermissions method', async () => {
      const adminRole = await Role.findByName('admin');
      const roleWithPermissions = await Role.findWithFullPermissions(adminRole._id);
      
      expect(roleWithPermissions.permissions).toHaveLength(2);
      expect(roleWithPermissions.permissions[0].name).toBeDefined();
      expect(roleWithPermissions.permissions[0].module.name).toBe('test-module');
    });
  });

  describe('Virtual Properties', () => {
    it('should have users virtual property', () => {
      const role = new Role({
        name: 'test-role',
        description: 'Test description'
      });

      expect(role.schema.virtuals.users).toBeDefined();
    });
  });

  describe('Indexes', () => {
    it('should have index on name field', () => {
      const indexes = Role.schema.indexes();
      const nameIndex = indexes.find(index => index[0].name === 1);
      expect(nameIndex).toBeDefined();
    });
  });

  describe('Relationships', () => {
    it('should maintain references to permissions', async () => {
      const role = new Role({
        name: 'relationship-test',
        description: 'Test role relationships',
        permissions: [testPermissions[0]._id, testPermissions[1]._id]
      });

      const savedRole = await role.save();
      expect(savedRole.permissions).toHaveLength(2);
      expect(savedRole.permissions[0]).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(savedRole.permissions[1]).toBeInstanceOf(mongoose.Types.ObjectId);
    });
  });
});