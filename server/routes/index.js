const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const alertRoutes = require('./alert.routes');
const contactRoutes = require('./contact.routes');
const notificationRoutes = require('./notification.routes');

const router = express.Router();

// Health check endpoint mounted at /api/health
router.use('/', healthRoutes);

// Authentication endpoints mounted at /api/auth
router.use('/auth', authRoutes);

// Emergency Alert endpoints mounted at /api/alerts
router.use('/alerts', alertRoutes);

// Emergency Contact endpoints mounted at /api/contacts
router.use('/contacts', contactRoutes);

// Emergency Notification endpoints mounted at /api/notifications
router.use('/notifications', notificationRoutes);

module.exports = router;
