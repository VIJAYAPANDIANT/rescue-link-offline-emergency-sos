/**
 * RescueLink Emergency Contact Controller
 *
 * Provides REST handlers for managing emergency contacts with
 * strict user isolation and input sanitization.
 */

const contactStore = require('../services/contactStore');
const { validateContactInput } = require('../validators/contact.validator');

/**
 * Retrieve all emergency contacts for the authenticated user.
 * @route GET /api/contacts
 * @access Protected (JWT required)
 */
const getContacts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contacts = await contactStore.findByUserId(userId);

    return res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new emergency contact for the authenticated user.
 * @route POST /api/contacts
 * @access Protected (JWT required)
 */
const createContact = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sanitizedData = validateContactInput(req.body, false);

    const newContact = await contactStore.createContact({
      ...sanitizedData,
      userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Emergency contact created successfully',
      data: newContact,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing emergency contact owned by the authenticated user.
 * @route PATCH /api/contacts/:id
 * @access Protected (JWT required)
 */
const updateContact = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const sanitizedData = validateContactInput(req.body, true);

    const updated = await contactStore.updateContact(id, userId, sanitizedData);
    if (!updated) {
      const err = new Error('The requested emergency contact was not found.');
      err.statusCode = 404;
      err.code = 'CONTACT_NOT_FOUND';
      throw err;
    }

    return res.status(200).json({
      success: true,
      message: 'Emergency contact updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an emergency contact owned by the authenticated user.
 * @route DELETE /api/contacts/:id
 * @access Protected (JWT required)
 */
const deleteContact = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await contactStore.deleteContact(id, userId);
    if (!deleted) {
      const err = new Error('The requested emergency contact was not found.');
      err.statusCode = 404;
      err.code = 'CONTACT_NOT_FOUND';
      throw err;
    }

    return res.status(200).json({
      success: true,
      message: 'Emergency contact deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getContacts,
  createContact,
  updateContact,
  deleteContact,
};
