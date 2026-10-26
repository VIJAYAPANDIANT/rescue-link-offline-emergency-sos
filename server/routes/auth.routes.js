/**
 * Authentication Routes
 * Mounted at /api/auth
 */
const express = require('express');
const { register, login, getProfile } = require('../controllers/auth.controller');
const authenticateToken = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/me
 * @desc    Get authenticated user profile
 * @access  Protected (Requires Bearer token)
 */
router.get('/me', authenticateToken, getProfile);

module.exports = router;
