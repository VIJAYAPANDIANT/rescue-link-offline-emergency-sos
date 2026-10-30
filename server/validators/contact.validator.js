/**
 * RescueLink Emergency Contact Validator
 *
 * Validates input fields for emergency contacts:
 * - Full name (2-60 chars)
 * - Phone number (E.164 or clean numeric format, 7-15 digits)
 * - Email address (Standard RFC format)
 * - Priority (1 = Primary, 2 = Secondary, 3 = Standard)
 * - Enabled state (boolean)
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGITS_REGEX = /^\+?[0-9\s\-().]{7,20}$/;

function validateContactInput(data, isUpdate = false) {
  if (!data || typeof data !== 'object') {
    const err = new Error('Request body must be a valid JSON object.');
    err.statusCode = 400;
    err.code = 'INVALID_BODY';
    throw err;
  }

  const sanitized = {};

  // 1. Name validation
  if (!isUpdate || data.name !== undefined) {
    if (!data.name || typeof data.name !== 'string') {
      const err = new Error('Contact name is required and must be a text string.');
      err.statusCode = 400;
      err.code = 'INVALID_NAME';
      throw err;
    }

    const trimmedName = data.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      const err = new Error('Contact name must be between 2 and 60 characters.');
      err.statusCode = 400;
      err.code = 'NAME_LENGTH_INVALID';
      throw err;
    }
    sanitized.name = trimmedName;
  }

  // 2. Phone validation
  if (data.phone !== undefined && data.phone !== null && data.phone !== '') {
    if (typeof data.phone !== 'string') {
      const err = new Error('Phone number must be a text string.');
      err.statusCode = 400;
      err.code = 'INVALID_PHONE_TYPE';
      throw err;
    }

    const trimmedPhone = data.phone.trim();
    if (!PHONE_DIGITS_REGEX.test(trimmedPhone)) {
      const err = new Error('Invalid phone number format. Must contain 7 to 15 digits.');
      err.statusCode = 400;
      err.code = 'INVALID_PHONE_FORMAT';
      throw err;
    }

    const digitCount = trimmedPhone.replace(/\D/g, '').length;
    if (digitCount < 7 || digitCount > 15) {
      const err = new Error('Phone number must contain between 7 and 15 digits.');
      err.statusCode = 400;
      err.code = 'PHONE_DIGITS_OUT_OF_BOUNDS';
      throw err;
    }
    sanitized.phone = trimmedPhone;
  } else if (!isUpdate) {
    sanitized.phone = null;
  }

  // 3. Email validation
  if (data.email !== undefined && data.email !== null && data.email !== '') {
    if (typeof data.email !== 'string') {
      const err = new Error('Email must be a text string.');
      err.statusCode = 400;
      err.code = 'INVALID_EMAIL_TYPE';
      throw err;
    }

    const trimmedEmail = data.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      const err = new Error('Invalid email address format.');
      err.statusCode = 400;
      err.code = 'INVALID_EMAIL_FORMAT';
      throw err;
    }
    sanitized.email = trimmedEmail;
  } else if (!isUpdate) {
    sanitized.email = null;
  }

  // Check that at least one delivery channel (phone or email) is present on creation
  if (!isUpdate) {
    if (!sanitized.phone && !sanitized.email) {
      const err = new Error('At least one notification destination (phone or email) must be provided.');
      err.statusCode = 400;
      err.code = 'MISSING_CONTACT_CHANNEL';
      throw err;
    }
  }

  // 4. Priority validation (1 = High/Primary, 2 = Medium, 3 = Standard)
  if (data.priority !== undefined && data.priority !== null) {
    const p = parseInt(data.priority, 10);
    if (isNaN(p) || p < 1 || p > 3) {
      const err = new Error('Contact priority must be an integer between 1 (Primary) and 3 (Standard).');
      err.statusCode = 400;
      err.code = 'INVALID_PRIORITY';
      throw err;
    }
    sanitized.priority = p;
  } else if (!isUpdate) {
    sanitized.priority = 1;
  }

  // 5. Relationship validation
  if (data.relationship !== undefined && data.relationship !== null) {
    if (typeof data.relationship !== 'string') {
      const err = new Error('Relationship must be a text string.');
      err.statusCode = 400;
      err.code = 'INVALID_RELATIONSHIP';
      throw err;
    }
    sanitized.relationship = data.relationship.trim().substring(0, 40);
  } else if (!isUpdate) {
    sanitized.relationship = 'Emergency Contact';
  }

  // 6. isEnabled validation
  if (data.isEnabled !== undefined) {
    sanitized.isEnabled = Boolean(data.isEnabled);
  } else if (!isUpdate) {
    sanitized.isEnabled = true;
  }

  return sanitized;
}

module.exports = {
  validateContactInput,
  EMAIL_REGEX,
  PHONE_DIGITS_REGEX,
};
