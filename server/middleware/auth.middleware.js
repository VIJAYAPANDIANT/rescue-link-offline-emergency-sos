/**
 * JWT Authentication Middleware
 *
 * Intercepts incoming requests, validates Bearer tokens in the Authorization header,
 * and attaches decoded user claims to `req.user`.
 */
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader) {
    // Expecting format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_FORMAT_INVALID',
          message: 'Invalid authorization format. Expected: Bearer <token>',
        },
      });
    }
    token = parts[1];
  } else if (req.query && req.query.token) {
    // Fallback for SSE / EventSource streams that cannot set headers
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_REQUIRED',
        message: 'Access denied. No authorization header provided.',
      },
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded; // { id, email, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Your authentication token has expired. Please log in again.',
        },
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_INVALID',
        message: 'Invalid authentication token provided.',
      },
    });
  }
};

/**
 * Require Administrator Role Middleware
 *
 * Enforces role-based access control by verifying that the authenticated user
 * has an active account with the 'admin' role.
 */
const requireAdmin = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required to access administrator endpoints.',
      },
    });
  }

  try {
    const userStore = require('../services/userStore');
    const user = await userStore.findById(req.user.id);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_ADMIN_REQUIRED',
          message: 'Access denied. Administrator privileges are required.',
        },
      });
    }

    if (user.status === 'suspended' || user.status === 'deactivated') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your administrator account has been suspended or deactivated.',
        },
      });
    }

    req.adminUser = userStore.toSafeUser(user);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.requireAdmin = requireAdmin;
