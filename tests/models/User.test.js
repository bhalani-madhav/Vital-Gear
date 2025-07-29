const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Role = require('../../models/Role');
const Permission = require('../../models/Permission');
const Module = require('../../models/Module');

describe('User Model', () => {
  let testRole;
  let testModule;
  let testPermission;

  beforeEach(async () => {
    // Create test module
    testModule = new Module({
      name: 'Users',
      description: 'User management module'
    });
    await testModule.save();

    // Create test permission
    testPermission = new Permission({
      name: 'user.read',
      description: 'Read user information',
      module: testModule._id,
      action: 'read'
    });
    await testPermission.save();

    // Create test role
    testRole = new Role({
      name: 'User',
      description: 'Standard user role',
      permissions: [testPermission._id]
    });
    await testRole.save();
  });

  describe('Schema Validation', () => {
    test('should create a valid user with required fields', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.firstName).toBe('John');
      expect(savedUser.lastName).toBe('Doe');
      expect(savedUser.email).toBe('john.doe@example.com');
      expect(savedUser.role).toEqual(testRole._id);
      expect(savedUser.isActive).toBe(true);
      expect(savedUser.password).toBeDefined();
      expect(savedUser.password).not.toBe('password123'); // Should be hashed
    });

    test('should fail validation without required fields', async () => {
      const user = new User({});
      
      await expect(user.save()).rejects.toThrow();
    });

    test('should fail validation with invalid email format', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        password: 'password123',
        role: testRole._id
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow();
    });

    test('should fail validation with short password', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: '123',
        role: testRole._id
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow();
    });

    test('should fail validation with short first name', async () => {
      const userData = {
        firstName: 'J',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow();
    });

    test('should normalize email to lowercase', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'JOHN.DOE@EXAMPLE.COM',
        password: 'password123',
        role: testRole._id
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.email).toBe('john.doe@example.com');
    });

    test('should enforce unique email constraint', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      const user1 = new User(userData);
      await user1.save();

      const user2 = new User(userData);
      await expect(user2.save()).rejects.toThrow();
    });
  });

  describe('Password Hashing', () => {
    test('should hash password before saving', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.password).not.toBe('password123');
      expect(savedUser.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });

    test('should not rehash password if not modified', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      const user = new User(userData);
      const savedUser = await user.save();
      const originalHash = savedUser.password;

      // Update non-password field
      savedUser.firstName = 'Jane';
      const updatedUser = await savedUser.save();

      expect(updatedUser.password).toBe(originalHash);
    });
  });

  describe('Password Comparison', () => {
    test('should compare password correctly', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      const user = new User(userData);
      const savedUser = await user.save();

      const isMatch = await savedUser.comparePassword('password123');
      expect(isMatch).toBe(true);

      const isNotMatch = await savedUser.comparePassword('wrongpassword');
      expect(isNotMatch).toBe(false);
    });

    test('should handle password comparison errors', async () => {
      const user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      });

      // Mock bcrypt.compare to throw an error
      const originalCompare = bcrypt.compare;
      bcrypt.compare = jest.fn().mockRejectedValue(new Error('Bcrypt error'));

      await expect(user.comparePassword('password123')).rejects.toThrow('Password comparison failed');

      // Restore original function
      bcrypt.compare = originalCompare;
    });
  });

  describe('Virtual Properties', () => {
    test('should return full name virtual', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      const user = new User(userData);
      expect(user.fullName).toBe('John Doe');
    });

    test('should return default address virtual', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id,
        addresses: [
          {
            type: 'home',
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zipCode: '12345',
            country: 'United States',
            isDefault: false
          },
          {
            type: 'work',
            street: '456 Work Ave',
            city: 'Worktown',
            state: 'CA',
            zipCode: '54321',
            country: 'United States',
            isDefault: true
          }
        ]
      };

      const user = new User(userData);
      expect(user.defaultAddress.street).toBe('456 Work Ave');
      expect(user.defaultAddress.isDefault).toBe(true);
    });

    test('should return first address as default when no default is set', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id,
        addresses: [
          {
            type: 'home',
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zipCode: '12345',
            country: 'United States',
            isDefault: false
          }
        ]
      };

      const user = new User(userData);
      expect(user.defaultAddress.street).toBe('123 Main St');
    });
  });

  describe('Address Management', () => {
    let user;

    beforeEach(async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      user = new User(userData);
      await user.save();
    });

    test('should validate address fields', async () => {
      const invalidAddress = {
        type: 'home',
        street: '',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'United States'
      };

      user.addresses.push(invalidAddress);
      await expect(user.save()).rejects.toThrow();
    });

    test('should validate ZIP code format', async () => {
      const invalidAddress = {
        type: 'home',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: 'invalid',
        country: 'United States'
      };

      user.addresses.push(invalidAddress);
      await expect(user.save()).rejects.toThrow();
    });

    test('should accept valid ZIP code formats', async () => {
      const validAddresses = [
        {
          type: 'home',
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'United States'
        },
        {
          type: 'work',
          street: '456 Work Ave',
          city: 'Worktown',
          state: 'CA',
          zipCode: '54321-1234',
          country: 'United States'
        }
      ];

      user.addresses = validAddresses;
      const savedUser = await user.save();

      expect(savedUser.addresses).toHaveLength(2);
      expect(savedUser.addresses[0].zipCode).toBe('12345');
      expect(savedUser.addresses[1].zipCode).toBe('54321-1234');
    });

    test('should ensure only one default address', async () => {
      const addresses = [
        {
          type: 'home',
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'United States',
          isDefault: true
        },
        {
          type: 'work',
          street: '456 Work Ave',
          city: 'Worktown',
          state: 'CA',
          zipCode: '54321',
          country: 'United States',
          isDefault: true
        }
      ];

      user.addresses = addresses;
      const savedUser = await user.save();

      const defaultAddresses = savedUser.addresses.filter(addr => addr.isDefault);
      expect(defaultAddresses).toHaveLength(1);
      expect(defaultAddresses[0].street).toBe('123 Main St');
    });

    test('should set first address as default when no default is specified', async () => {
      const addresses = [
        {
          type: 'home',
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'United States'
        }
      ];

      user.addresses = addresses;
      const savedUser = await user.save();

      expect(savedUser.addresses[0].isDefault).toBe(true);
    });
  });

  describe('Instance Methods', () => {
    let user;

    beforeEach(async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      user = new User(userData);
      await user.save();
    });

    test('should populate role with getWithRole method', async () => {
      const userWithRole = await user.getWithRole();
      
      expect(userWithRole.role).toBeDefined();
      expect(userWithRole.role.name).toBe('User');
      expect(userWithRole.role.permissions).toBeDefined();
    });

    test('should check permissions with hasPermission method', async () => {
      const hasPermission = await user.hasPermission('user.read');
      expect(hasPermission).toBe(true);

      const hasInvalidPermission = await user.hasPermission('admin.delete');
      expect(hasInvalidPermission).toBe(false);
    });

    test('should add address with addAddress method', async () => {
      const newAddress = {
        type: 'home',
        street: '789 New St',
        city: 'Newtown',
        state: 'NY',
        zipCode: '67890',
        country: 'United States',
        isDefault: true
      };

      await user.addAddress(newAddress);
      
      expect(user.addresses).toHaveLength(1);
      expect(user.addresses[0].street).toBe('789 New St');
      expect(user.addresses[0].isDefault).toBe(true);
    });

    test('should update address with updateAddress method', async () => {
      const address = {
        type: 'home',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'United States'
      };

      await user.addAddress(address);
      const addressId = user.addresses[0]._id;

      await user.updateAddress(addressId, { street: '456 Updated St' });

      expect(user.addresses[0].street).toBe('456 Updated St');
    });

    test('should throw error when updating non-existent address', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      expect(() => user.updateAddress(fakeId, { street: '456 Updated St' }))
        .toThrow('Address not found');
    });

    test('should remove address with removeAddress method', async () => {
      const address = {
        type: 'home',
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'United States'
      };

      await user.addAddress(address);
      const addressId = user.addresses[0]._id;

      await user.removeAddress(addressId);

      expect(user.addresses).toHaveLength(0);
    });

    test('should throw error when removing non-existent address', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      expect(() => user.removeAddress(fakeId))
        .toThrow('Address not found');
    });

    test('should update last login with updateLastLogin method', async () => {
      const originalLastLogin = user.lastLogin;
      
      await user.updateLastLogin();
      
      expect(user.lastLogin).toBeDefined();
      expect(user.lastLogin).not.toBe(originalLastLogin);
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      const user = new User(userData);
      await user.save();
    });

    test('should find user by email with findByEmail method', async () => {
      const user = await User.findByEmail('john.doe@example.com');
      
      expect(user).toBeDefined();
      expect(user.firstName).toBe('John');
      expect(user.password).toBeUndefined(); // Should not include password
    });

    test('should find user by email with password using findByEmailWithPassword method', async () => {
      const user = await User.findByEmailWithPassword('john.doe@example.com');
      
      expect(user).toBeDefined();
      expect(user.firstName).toBe('John');
      expect(user.password).toBeDefined(); // Should include password
    });

    test('should find active users with findActiveUsers method', async () => {
      const users = await User.findActiveUsers();
      
      expect(users).toHaveLength(1);
      expect(users[0].isActive).toBe(true);
    });

    test('should find users by role with findByRole method', async () => {
      const users = await User.findByRole(testRole._id);
      
      expect(users).toHaveLength(1);
      expect(users[0].role.name).toBe('User');
    });
  });

  describe('JSON Transformation', () => {
    test('should exclude password from JSON output', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      const user = new User(userData);
      const savedUser = await user.save();
      const userJSON = savedUser.toJSON();

      expect(userJSON.password).toBeUndefined();
      expect(userJSON.firstName).toBe('John');
    });

    test('should exclude password from Object output', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: testRole._id
      };

      const user = new User(userData);
      const savedUser = await user.save();
      const userObject = savedUser.toObject();

      expect(userObject.password).toBeUndefined();
      expect(userObject.firstName).toBe('John');
    });
  });
});