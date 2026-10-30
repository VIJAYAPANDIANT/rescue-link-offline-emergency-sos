/**
 * Admin Dashboard & Monitoring Routes
 * Mounted at /api/admin
 *
 * Security: All routes strictly require valid JWT authentication AND
 * administrator role authorization (requireAdmin).
 */

const express = require('express');
const {
  getDashboardOverview,
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  getUsers,
  updateUserStatus,
  getRelayActivity,
  getNotifications,
  getAuditLogs,
} = require('../controllers/admin.controller');
const { authenticateToken, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Enforce authentication & administrator authorization on all /api/admin routes
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * Overview & Analytics
 */
router.get('/dashboard', getDashboardOverview);

/**
 * SOS Incident Management
 */
router.get('/incidents', getIncidents);
router.get('/incidents/:id', getIncidentById);
router.patch('/incidents/:id/status', updateIncidentStatus);

/**
 * User Management
 */
router.get('/users', getUsers);
router.patch('/users/:id/status', updateUserStatus);

/**
 * Multi-Device Relay Monitoring
 */
router.get('/relay', getRelayActivity);

/**
 * Notification Task Monitoring
 */
router.get('/notifications', getNotifications);

/**
 * Administrative Audit Logs
 */
router.get('/audit-logs', getAuditLogs);

module.exports = router;
