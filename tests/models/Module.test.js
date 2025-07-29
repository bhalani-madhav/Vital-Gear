const mongoose = require('mongoose');
const Module = require('../../models/Module');
require('../setup');

describe('Module Model', () => {
  describe('Schema Validation', () => {
    it('should create a valid module with required fields', async () => {
      const moduleData = {
        name: 'user-management',
        description: 'User management module for handling user operations'
      };

      const module = new Module(moduleData);
      const savedModule = await module.save();

      expect(savedModule._id).toBeDefined();
      expect(savedModule.name).toBe('user-management');
      expect(savedModule.description).toBe(moduleData.description);
      expect(savedModule.createdAt).toBeDefined();
      expect(savedModule.updatedAt).toBeDefined();
    });

    it('should fail validation when name is missing', async () => {
      const module = new Module({
        description: 'Test description'
      });

      await expect(module.save()).rejects.toThrow('Module name is required');
    });

    it('should fail validation when description is missing', async () => {
      const module = new Module({
        name: 'test-module'
      });

      await expect(module.save()).rejects.toThrow('Module description is required');
    });

    it('should fail validation when name is too short', async () => {
      const module = new Module({
        name: 'a',
        description: 'Test description'
      });

      await expect(module.save()).rejects.toThrow('Module name must be at least 2 characters long');
    });

    it('should fail validation when name is too long', async () => {
      const module = new Module({
        name: 'a'.repeat(51),
        description: 'Test description'
      });

      await expect(module.save()).rejects.toThrow('Module name cannot exceed 50 characters');
    });

    it('should fail validation when description is too long', async () => {
      const module = new Module({
        name: 'test-module',
        description: 'a'.repeat(201)
      });

      await expect(module.save()).rejects.toThrow('Module description cannot exceed 200 characters');
    });

    it('should enforce unique name constraint', async () => {
      const moduleData = {
        name: 'unique-module',
        description: 'First module'
      };

      await new Module(moduleData).save();

      const duplicateModule = new Module({
        name: 'unique-module',
        description: 'Second module'
      });

      await expect(duplicateModule.save()).rejects.toThrow();
    });

    it('should trim whitespace from name and description', async () => {
      const module = new Module({
        name: '  test-module  ',
        description: '  Test description  '
      });

      const savedModule = await module.save();
      expect(savedModule.name).toBe('test-module');
      expect(savedModule.description).toBe('Test description');
    });
  });

  describe('Pre-save Middleware', () => {
    it('should convert name to lowercase before saving', async () => {
      const module = new Module({
        name: 'TEST-MODULE',
        description: 'Test description'
      });

      const savedModule = await module.save();
      expect(savedModule.name).toBe('test-module');
    });
  });

  describe('Instance Methods', () => {
    it('should populate permissions with getWithPermissions method', async () => {
      const module = new Module({
        name: 'test-module',
        description: 'Test description'
      });

      const savedModule = await module.save();
      const moduleWithPermissions = await savedModule.getWithPermissions();
      
      expect(moduleWithPermissions).toBeDefined();
      expect(moduleWithPermissions._id).toEqual(savedModule._id);
    });
  });

  describe('Static Methods', () => {
    it('should find module by name using findByName method', async () => {
      const moduleData = {
        name: 'search-module',
        description: 'Module for searching'
      };

      await new Module(moduleData).save();

      const foundModule = await Module.findByName('search-module');
      expect(foundModule).toBeDefined();
      expect(foundModule.name).toBe('search-module');
    });

    it('should find module by name case-insensitively', async () => {
      const moduleData = {
        name: 'case-test',
        description: 'Case test module'
      };

      await new Module(moduleData).save();

      const foundModule = await Module.findByName('CASE-TEST');
      expect(foundModule).toBeDefined();
      expect(foundModule.name).toBe('case-test');
    });

    it('should return null when module not found', async () => {
      const foundModule = await Module.findByName('non-existent');
      expect(foundModule).toBeNull();
    });
  });

  describe('Virtual Properties', () => {
    it('should have permissions virtual property', () => {
      const module = new Module({
        name: 'test-module',
        description: 'Test description'
      });

      expect(module.schema.virtuals.permissions).toBeDefined();
    });
  });

  describe('Indexes', () => {
    it('should have index on name field', () => {
      const indexes = Module.schema.indexes();
      const nameIndex = indexes.find(index => index[0].name === 1);
      expect(nameIndex).toBeDefined();
    });
  });
});