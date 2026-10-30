/**
 * Authentication Controller
 *
 * Handles user registration, login, and profile retrieval.
 * Employs bcryptjs for irreversible password hashing and JSON Web Tokens for state validation.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userStore = require('../services/userStore');

// Email regex pattern for validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Helper to validate user registration input
 */
const validateRegisterInput = ({ name, email, password }) => {
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long.');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  return errors;
};

/**
 * Register a new user account
 * @route POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate inputs
    const validationErrors = validateRegisterInput({ name, email, password });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationErrors.join(' '),
          details: validationErrors,
        },
      });
    }

    // Check if email is already taken
    const existingUser = await userStore.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
    }

    // Hash password with bcrypt (10 rounds)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Save user to JSON store
    const safeUser = await userStore.createUser({
      name,
      email,
      passwordHash,
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: safeUser.id, email: safeUser.email, role: safeUser.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user: safeUser,
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticate existing user and issue JWT token
 * @route POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Both email and password are required to login.',
        },
      });
    }

    // Find user by normalized email
    const user = await userStore.findByEmail(email);
    if (!user) {
      // Intentionally generic response to prevent user enumeration
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email address or password.',
        },
      });
    }

    // Compare provided password with stored hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email address or password.',
        },
      });
    }

    if (user.status === 'suspended' || user.status === 'deactivated') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended or deactivated. Please contact an administrator.',
        },
      });
    }

    const safeUser = userStore.toSafeUser(user);

    // Generate JWT token
    const token = jwt.sign(
      { id: safeUser.id, email: safeUser.email, role: safeUser.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: safeUser,
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve authenticated user profile
 * @route GET /api/auth/me
 * @access Protected
 */
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await userStore.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The requested user profile was not found.',
        },
      });
    }

    return res.status(200).json({
      success: true,
      user: userStore.toSafeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
};
