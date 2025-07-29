const User = require('../models/User');
const Role = require('../models/Role');
const { generateToken } = require('../utils/jwt');
const { sendSuccess, sendError, sendConflict, sendValidationError, sendUnauthorized } = require('../utils/responseHandler');

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return sendConflict(res, 'User with this email already exists', {
        field: 'email',
        value: email
      });
    }

    // Find default user role
    const userRole = await Role.findByName('User');
    if (!userRole) {
      return sendError(res, 'Default user role not found. Please contact administrator.', 500);
    }

    // Create new user
    const userData = {
      firstName,
      lastName,
      email,
      password,
      role: userRole._id
    };

    const newUser = new User(userData);
    await newUser.save();

    // Populate role information for response
    await newUser.populate('role');

    // Remove sensitive information from response
    const userResponse = {
      id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      fullName: newUser.fullName,
      email: newUser.email,
      role: {
        id: newUser.role._id,
        name: newUser.role.name,
        description: newUser.role.description
      },
      isActive: newUser.isActive,
      createdAt: newUser.createdAt
    };

    return sendSuccess(
      res,
      userResponse,
      'User registered successfully',
      201
    );

  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      return sendValidationError(res, validationErrors, 'Registration validation failed');
    }

    // Handle duplicate key error (email already exists)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return sendConflict(res, `User with this ${field} already exists`, {
        field,
        value: error.keyValue[field]
      });
    }

    console.error('Registration error:', error);
    return sendError(res, 'Registration failed. Please try again.', 500);
  }
};

/**
 * Login user and generate JWT token
 * @route POST /api/auth/login
 * @access Public
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email with password field included
    const user = await User.findByEmailWithPassword(email);
    if (!user) {
      return sendUnauthorized(res, 'Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      return sendUnauthorized(res, 'Account has been deactivated. Please contact administrator.');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return sendUnauthorized(res, 'Invalid email or password');
    }

    // Populate role information
    await user.populate('role');

    // Update last login timestamp
    await user.updateLastLogin();

    // Generate JWT token
    const token = generateToken(user);

    // Prepare user response (exclude password)
    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      email: user.email,
      role: {
        id: user.role._id,
        name: user.role.name,
        description: user.role.description
      },
      isActive: user.isActive,
      lastLogin: user.lastLogin
    };

    // Send response with token and user data
    return sendSuccess(
      res,
      {
        user: userResponse,
        token,
        tokenType: 'Bearer',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      },
      'Login successful'
    );

  } catch (error) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      return sendValidationError(res, validationErrors, 'Login validation failed');
    }

    console.error('Login error:', error);
    return sendError(res, 'Login failed. Please try again.', 500);
  }
};

module.exports = {
  registerUser,
  loginUser
};