/**
 * RescueLink BLE Message Protocol
 *
 * Implements versioned serialization, deserialization, size enforcement,
 * and security sanitization for BLE characteristics payloads.
 */

import base64 from 'base-64';
const btoa = typeof base64.encode === 'function' ? base64.encode : base64;
const atob = typeof base64.decode === 'function' ? base64.decode : base64;
import { BLE_PROTOCOL, BLE_MESSAGE_TYPES } from './bleConstants.js';

/**
 * Construct a valid SOS_ALERT payload for BLE broadcasting.
 * Note: Never includes JWTs, passwords, or sensitive credentials.
 */
export const buildSOSAlertPayload = ({
  alertId,
  id,
  emergencyType,
  details = '',
  senderName = 'Unknown Responder',
  latitude = null,
  longitude = null,
  createdAt = new Date().toISOString(),
}) => {
  const finalAlertId = alertId || id;
  if (!finalAlertId) {
    throw new Error('Protocol Error: alertId is required for SOS_ALERT payload.');
  }

  return {
    version: BLE_PROTOCOL.VERSION,
    type: BLE_MESSAGE_TYPES.SOS_ALERT,
    alertId: finalAlertId,
    emergencyType: emergencyType || 'Other',
    details: details ? details.substring(0, 200) : '', // Bound details to stay under MTU limit
    senderName: senderName ? senderName.substring(0, 50) : 'Anonymous',
    latitude: typeof latitude === 'number' && Number.isFinite(latitude) ? Number(latitude.toFixed(4)) : null,
    longitude: typeof longitude === 'number' && Number.isFinite(longitude) ? Number(longitude.toFixed(4)) : null,
    createdAt,
  };
};

/**
 * Construct a valid SOS_ACK payload for BLE acknowledgment.
 */
export const buildSOSAcknowledgePayload = ({ alertId, receiverId }) => {
  if (!alertId) {
    throw new Error('Protocol Error: alertId is required for SOS_ACK payload.');
  }

  return {
    version: BLE_PROTOCOL.VERSION,
    type: BLE_MESSAGE_TYPES.SOS_ACK,
    alertId,
    receiverId: receiverId || `node-${Math.random().toString(36).substring(2, 8)}`,
    receivedAt: new Date().toISOString(),
  };
};

/**
 * Strip sensitive credentials from an object payload.
 */
export const sanitizeBLEPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return {};
  const { token, password, passwordHash, ...clean } = payload;
  return clean;
};

/**
 * Serialize a message object into a Base64 string for BLE transmission.
 * Enforces maximum size bounds (512 bytes).
 */
export const serializeBLEMessage = (messageObj) => {
  // Strip any accidental credential fields
  const cleanPayload = sanitizeBLEPayload(messageObj);

  const jsonStr = JSON.stringify(cleanPayload);
  const byteLength = unescape(encodeURIComponent(jsonStr)).length;

  if (byteLength > BLE_PROTOCOL.MAX_PAYLOAD_BYTES) {
    throw new Error(
      `Message size (${byteLength} bytes) exceeds maximum BLE characteristic MTU of ${BLE_PROTOCOL.MAX_PAYLOAD_BYTES} bytes.`
    );
  }

  // Base-64 encode for react-native-ble-plx compatibility
  return btoa(unescape(encodeURIComponent(jsonStr)));
};

/**
 * Safely deserialize and validate incoming Base64 or JSON BLE characteristic values.
 * Catches malformed JSON without crashing the application.
 */
export const deserializeBLEMessage = (rawPayload) => {
  if (!rawPayload || typeof rawPayload !== 'string') {
    return { valid: false, error: 'Empty or invalid payload received.' };
  }

  let jsonStr = '';

  // Attempt base-64 decode first, fallback to raw string
  try {
    jsonStr = decodeURIComponent(escape(atob(rawPayload)));
  } catch (b64Error) {
    jsonStr = rawPayload;
  }

  try {
    const parsed = JSON.parse(jsonStr);

    if (typeof parsed !== 'object' || parsed === null) {
      return { valid: false, error: 'Payload root must be an object.' };
    }

    if (parsed.version !== BLE_PROTOCOL.VERSION) {
      return {
        valid: false,
        error: `Incompatible protocol version ${parsed.version}. Expected ${BLE_PROTOCOL.VERSION}.`,
      };
    }

    if (!parsed.type || !Object.values(BLE_MESSAGE_TYPES).includes(parsed.type)) {
      return { valid: false, error: `Unrecognized message type "${parsed.type}".` };
    }

    if (!parsed.alertId || typeof parsed.alertId !== 'string') {
      return { valid: false, error: 'Missing or invalid alertId in payload.' };
    }

    // Scrub any unexpected credential fields
    delete parsed.token;
    delete parsed.password;
    delete parsed.passwordHash;

    return {
      valid: true,
      message: parsed,
    };
  } catch (parseError) {
    return {
      valid: false,
      error: `Malformed JSON payload: ${parseError.message}`,
    };
  }
};
