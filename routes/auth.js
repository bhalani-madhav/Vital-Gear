const express = require("express");
const { registerUser, loginUser } = require("../controllers/authController");
const {
  validateUserRegistration,
  validateUserLogin,
} = require("../middlewares/validation");

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register", validateUserRegistration, registerUser);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get JWT token
 * @access  Public
 */
router.post("/login", validateUserLogin, loginUser);

module.exports = router;
