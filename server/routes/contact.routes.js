/**
 * RescueLink Emergency Contact Routes
 * Mounted at /api/contacts
 */

const express = require('express');
const {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
} = require('../controllers/contact.controller');
const authenticateToken = require('../middleware/auth.middleware');

const router = express.Router();

// All contact routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/contacts
 * @desc    Get all emergency contacts for current user
 * @access  Protected
 */
router.get('/', getContacts);

/**
 * @route   POST /api/contacts
 * @desc    Create a new emergency contact
 * @access  Protected
 */
router.post('/', createContact);

/**
 * @route   PATCH /api/contacts/:id
 * @desc    Update an existing emergency contact
 * @access  Protected
 */
router.patch('/:id', updateContact);

/**
 * @route   DELETE /api/contacts/:id
 * @desc    Delete an emergency contact
 * @access  Protected
 */
router.delete('/:id', deleteContact);

module.exports = router;
