const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Role = require('../../models/Role');
const { generateToken, verifyToken } = require('../../utils/jwt');
const authRoutes = require('../../routes/auth');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Controller - User Registration', () => {
  let userRole;

  beforeEach(async () => {
    // Create default user role for testing
    userRole = new Role({
      name: 'User',
      description: 'Default user role with basic permissions'
    });
    await userRole.save();
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'SecurePass123!'
    };

    it('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully',
        data: {
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          email: 'john.doe@example.com',
          role: {
            name: 'User',
            description: 'Default user role with basic permissions'
          },
          isActive: true
        }
      });

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('createdAt');
      expect(response.body.data).not.toHaveProperty('password');

      // Verify user was created in database
      const createdUser = await User.findByEmail('john.doe@example.com');
      expect(createdUser).toBeTruthy();
      expect(createdUser.firstName).toBe('John');
      expect(createdUser.lastName).toBe('Doe');
      expect(createdUser.role.toString()).toBe(userRole._id.toString());
    });

    it('should return conflict error when email already exists', async () => {
      // Create user first
      const existingUser = new User({
        ...validUserData,
        role: userRole._id
      });
      await existingUser.save();

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        message: 'User with this email already exists',
        error: {
          type: 'ConflictError',
          details: {
            field: 'email',
            value: 'john.doe@example.com'
          }
        }
      });
    });

    it('should return validation error for missing required fields', async () => {
      const invalidData = {
        firstName: 'John'
        // Missing lastName, email, password
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: {
          type: 'ValidationError'
        }
      });

      expect(response.body.error.details).toBeInstanceOf(Array);
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });

    it('should return validation error for invalid email format', async () => {
      const invalidEmailData = {
        ...validUserData,
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: {
          type: 'ValidationError'
        }
      });
    });

    it('should return validation error for weak password', async () => {
      const weakPasswordData = {
        ...validUserData,
        password: '123' // Too short and weak
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: {
          type: 'ValidationError'
        }
      });
    });

    it('should return validation error for invalid name format', async () => {
      const invalidNameData = {
        ...validUserData,
        firstName: 'J', // Too short
        lastName: 'D123' // Contains numbers
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidNameData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: {
          type: 'ValidationError'
        }
      });
    });

    it('should hash password before saving to database', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      const createdUser = await User.findByEmail('john.doe@example.com').select('+password');
      expect(createdUser.password).not.toBe(validUserData.password);
      expect(createdUser.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });

    it('should normalize email to lowercase', async () => {
      const upperCaseEmailData = {
        ...validUserData,
        email: 'JOHN.DOE@EXAMPLE.COM'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(upperCaseEmailData)
        .expect(201);

      expect(response.body.data.email).toBe('john.doe@example.com');

      const createdUser = await User.findByEmail('john.doe@example.com');
      expect(createdUser.email).toBe('john.doe@example.com');
    });

    it('should return server error when default role does not exist', async () => {
      // Remove the default role
      await Role.deleteMany({});

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Default user role not found. Please contact administrator.'
      });
    });

    it('should trim whitespace from name fields', async () => {
      const dataWithWhitespace = {
        ...validUserData,
        firstName: '  John  ',
        lastName: '  Doe  '
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(dataWithWhitespace)
        .expect(201);

      expect(response.body.data.firstName).toBe('John');
      expect(response.body.data.lastName).toBe('Doe');
    });

    it('should set user as active by default', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.data.isActive).toBe(true);

      const createdUser = await User.findByEmail('john.doe@example.com');
      expect(createdUser.isActive).toBe(true);
    });

    it('should assign default user role to new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.data.role.name).toBe('User');
      expect(response.body.data.role.description).toBe('Default user role with basic permissions');

      const createdUser = await User.findByEmail('john.doe@example.com');
      expect(createdUser.role.toString()).toBe(userRole._id.toString());
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;
    const loginCredentials = {
      email: 'john.doe@example.com',
      password: 'SecurePass123!'
    };

    beforeEach(async () => {
      // Create a test user for login tests
      testUser = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'SecurePass123!',
        role: userRole._id
      });
      await testUser.save();
    });

    it('should login user with valid credentials and return JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginCredentials)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            firstName: 'John',
            lastName: 'Doe',
            fullName: 'John Doe',
            email: 'john.doe@example.com',
            role: {
              name: 'User',
              description: 'Default user role with basic permissions'
            },
            isActive: true
          },
          tokenType: 'Bearer',
          expiresIn: '24h'
        }
      });

      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user).toHaveProperty('lastLogin');
      expect(response.body.data.user).not.toHaveProperty('password');

      // Verify JWT token is valid
      const decodedToken = verifyToken(response.body.data.token);
      expect(decodedToken.id).toBe(testUser._id.toString());
      expect(decodedToken.email).toBe('john.doe@example.com');
    });

    it('should return unauthorized error for invalid email', async () => {
      const invalidCredentials = {
        email: 'nonexistent@example.com',
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidCredentials)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid email or password',
        error: {
          type: 'AuthenticationError'
        }
      });
    });

    it('should return unauthorized error for invalid password', async () => {
      const invalidCredentials = {
        email: 'john.doe@example.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidCredentials)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid email or password',
        error: {
          type: 'AuthenticationError'
        }
      });
    });

    it('should return unauthorized error for inactive user', async () => {
      // Deactivate the test user
      testUser.isActive = false;
      await testUser.save();

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginCredentials)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Account has been deactivated. Please contact administrator.',
        error: {
          type: 'AuthenticationError'
        }
      });
    });

    it('should return validation error for missing email', async () => {
      const invalidData = {
        password: 'SecurePass123!'
        // Missing email
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: {
          type: 'ValidationError'
        }
      });
    });

    it('should return validation error for missing password', async () => {
      const invalidData = {
        email: 'john.doe@example.com'
        // Missing password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: {
          type: 'ValidationError'
        }
      });
    });

    it('should return validation error for invalid email format', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        error: {
          type: 'ValidationError'
        }
      });
    });

    it('should update last login timestamp on successful login', async () => {
      const originalLastLogin = testUser.lastLogin;

      await request(app)
        .post('/api/auth/login')
        .send(loginCredentials)
        .expect(200);

      // Refresh user from database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.lastLogin).toBeTruthy();
      expect(updatedUser.lastLogin).not.toEqual(originalLastLogin);
    });

    it('should normalize email to lowercase during login', async () => {
      const upperCaseCredentials = {
        email: 'JOHN.DOE@EXAMPLE.COM',
        password: 'SecurePass123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(upperCaseCredentials)
        .expect(200);

      expect(response.body.data.user.email).toBe('john.doe@example.com');
    });

    it('should include role information in login response', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginCredentials)
        .expect(200);

      expect(response.body.data.user.role).toMatchObject({
        name: 'User',
        description: 'Default user role with basic permissions'
      });
      expect(response.body.data.user.role).toHaveProperty('id');
    });

    it('should generate valid JWT token with correct payload', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginCredentials)
        .expect(200);

      const token = response.body.data.token;
      const decodedToken = verifyToken(token);

      expect(decodedToken).toHaveProperty('id');
      expect(decodedToken).toHaveProperty('email');
      expect(decodedToken).toHaveProperty('role');
      expect(decodedToken).toHaveProperty('iat');
      expect(decodedToken).toHaveProperty('exp');

      expect(decodedToken.id).toBe(testUser._id.toString());
      expect(decodedToken.email).toBe('john.doe@example.com');
      expect(decodedToken.role).toBe(userRole._id.toString());
    });
  });
});