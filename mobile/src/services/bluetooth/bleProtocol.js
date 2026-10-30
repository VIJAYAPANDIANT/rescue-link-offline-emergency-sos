/**
 * RescueLink BLE Message Protocol
 *
 * Implements versioned serialization, deserialization, size enforcement,
 * message integrity hashing, multi-device relay routing, and security sanitization.
 */

import base64 from 'base-64';
const btoa = typeof base64.encode === 'function' ? base64.encode : base64;
const atob = typeof base64.decode === 'function' ? base64.decode : base64;
import { BLE_PROTOCOL, BLE_MESSAGE_TYPES } from './bleConstants.js';

/**
 * Compute a deterministic 32-bit FNV-1a checksum over the immutable core alert content.
 * Any modification to the distress message, coordinates, emergency type, or alertId
 * will invalidate this checksum.
 *
 * @param {object} params
 * @returns {string} 8-character lowercase hex string
 */
export const computeAlertIntegrityHash = ({
  alertId,
  id,
  emergencyType,
  details = '',
  latitude = null,
  longitude = null,
  createdAt,
  originalSenderId = null,
}) => {
  const finalAlertId = alertId || id || '';
  const finalType = emergencyType || '';
  const finalDetails = details ? details.trim() : '';
  const normLat =
    typeof latitude === 'number' && Number.isFinite(latitude) ? latitude.toFixed(4) : '';
  const normLon =
    typeof longitude === 'number' && Number.isFinite(longitude) ? longitude.toFixed(4) : '';
  const finalCreated = createdAt || '';
  const finalSender = originalSenderId || '';

  const content = `${finalAlertId}|${finalType}|${finalDetails}|${normLat}|${normLon}|${finalCreated}|${finalSender}`;

  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

/**
 * Verify whether an alert payload matches its cryptographic/checksum integrity hash.
 *
 * @param {object} alertPayload
 * @returns {{ valid: boolean, error?: string, legacy?: boolean }}
 */
export const verifyAlertIntegrity = (alertPayload) => {
  if (!alertPayload || typeof alertPayload !== 'object') {
    return { valid: false, error: 'Alert payload must be a non-null object.' };
  }

  // Version 1 legacy payloads did not include an integrity hash
  if (alertPayload.version === 1 && !alertPayload.integrityHash) {
    return { valid: true, legacy: true };
  }

  if (!alertPayload.integrityHash || typeof alertPayload.integrityHash !== 'string') {
    return { valid: false, error: 'Missing required integrityHash in message payload.' };
  }

  const expectedHash = computeAlertIntegrityHash(alertPayload);
  if (expectedHash !== alertPayload.integrityHash) {
    return {
      valid: false,
      error: `Integrity hash mismatch: Expected ${expectedHash}, received ${alertPayload.integrityHash}. Content may have been modified in transit.`,
    };
  }

  return { valid: true };
};

/**
 * Construct a valid SOS_ALERT payload for BLE broadcasting.
 * Supports Step 8 Multi-Device Relay fields:
 * - hopCount
 * - maxHops
 * - forwarderId
 * - originalSenderId
 * - expiresAt
 * - integrityHash
 *
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
  // Step 8: Multi-Device Relay extensions
  originalSenderId = null,
  forwarderId = null,
  hopCount = 0,
  maxHops = BLE_PROTOCOL.RELAY_LIMITS?.DEFAULT_MAX_HOPS || 3,
  expiresAt = null,
  ttlHours = BLE_PROTOCOL.RELAY_LIMITS?.DEFAULT_TTL_HOURS || 24,
  integrityHash = null,
  version = BLE_PROTOCOL.VERSION,
}) => {
  const finalAlertId = alertId || id;
  if (!finalAlertId) {
    throw new Error('Protocol Error: alertId is required for SOS_ALERT payload.');
  }

  const boundDetails = details ? details.substring(0, 180) : '';
  const boundSenderName = senderName ? senderName.substring(0, 40) : 'Anonymous';
  const cleanLat =
    typeof latitude === 'number' && Number.isFinite(latitude) ? Number(latitude.toFixed(4)) : null;
  const cleanLon =
    typeof longitude === 'number' && Number.isFinite(longitude) ? Number(longitude.toFixed(4)) : null;

  // Calculate default expiration timestamp if not provided
  const createdDate = new Date(createdAt);
  const finalExpiresAt =
    expiresAt ||
    new Date(
      (isNaN(createdDate.getTime()) ? Date.now() : createdDate.getTime()) +
        ttlHours * 60 * 60 * 1000
    ).toISOString();

  // Compute immutable integrity hash over original alert content
  const finalIntegrityHash =
    integrityHash ||
    computeAlertIntegrityHash({
      alertId: finalAlertId,
      emergencyType: emergencyType || 'Other',
      details: boundDetails,
      latitude: cleanLat,
      longitude: cleanLon,
      createdAt,
      originalSenderId: originalSenderId || null,
    });

  return {
    version: version || BLE_PROTOCOL.VERSION,
    type: BLE_MESSAGE_TYPES.SOS_ALERT,
    alertId: finalAlertId,
    emergencyType: emergencyType || 'Other',
    details: boundDetails,
    senderName: boundSenderName,
    latitude: cleanLat,
    longitude: cleanLon,
    createdAt,
    // Step 8 Relay Routing Metadata
    originalSenderId: originalSenderId || null,
    forwarderId: forwarderId || null,
    hopCount: typeof hopCount === 'number' ? hopCount : 0,
    maxHops: typeof maxHops === 'number' ? maxHops : (BLE_PROTOCOL.RELAY_LIMITS?.DEFAULT_MAX_HOPS || 3),
    expiresAt: finalExpiresAt,
    integrityHash: finalIntegrityHash,
  };
};

/**
 * Construct a forwarded relay payload from an existing alert.
 * Increments hopCount, sets the current forwarderId, and preserves immutable core content & integrityHash.
 *
 * @param {object} alert - Original alert to forward
 * @param {string} forwarderId - Current forwarding device identifier
 * @returns {object} Forwarded SOS_ALERT payload
 */
export const buildRelayForwardPayload = (alert, forwarderId) => {
  if (!alert) {
    throw new Error('Valid alert object is required to build relay forward payload.');
  }

  const alertId = alert.alertId || alert.id;
  if (!alertId) {
    throw new Error('Valid alertId is required to construct relay forward payload.');
  }

  if (!forwarderId || typeof forwarderId !== 'string') {
    throw new Error('forwarderId is required to identify the current forwarding device.');
  }

  const currentHop = typeof alert.hopCount === 'number' ? alert.hopCount : 0;
  const maxHops =
    typeof alert.maxHops === 'number' ? alert.maxHops : (BLE_PROTOCOL.RELAY_LIMITS?.DEFAULT_MAX_HOPS || 3);

  if (currentHop >= maxHops) {
    throw new Error(
      `Cannot forward alert ${alertId}: hop limit reached (${currentHop}/${maxHops}).`
    );
  }

  // Preserve immutable content and original integrity hash
  const immutableIntegrityHash =
    alert.integrityHash ||
    computeAlertIntegrityHash({
      alertId,
      emergencyType: alert.emergencyType,
      details: alert.details,
      latitude: alert.latitude,
      longitude: alert.longitude,
      createdAt: alert.createdAt,
      originalSenderId: alert.originalSenderId || alert.senderId || null,
    });

  return {
    version: alert.version || BLE_PROTOCOL.VERSION,
    type: BLE_MESSAGE_TYPES.SOS_ALERT,
    alertId,
    emergencyType: alert.emergencyType || 'Other',
    details: alert.details ? alert.details.substring(0, 180) : '',
    senderName: alert.senderName || 'Anonymous',
    latitude: typeof alert.latitude === 'number' ? Number(alert.latitude.toFixed(4)) : null,
    longitude: typeof alert.longitude === 'number' ? Number(alert.longitude.toFixed(4)) : null,
    createdAt: alert.createdAt,
    originalSenderId: alert.originalSenderId || alert.senderId || null,
    // Step 8: Updated relay transmission fields
    forwarderId,
    hopCount: currentHop + 1,
    maxHops,
    expiresAt: alert.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    integrityHash: immutableIntegrityHash,
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

    const supportedVersions = BLE_PROTOCOL.SUPPORTED_VERSIONS || [BLE_PROTOCOL.VERSION];
    if (!supportedVersions.includes(parsed.version)) {
      return {
        valid: false,
        error: `Incompatible protocol version ${parsed.version}. Expected one of: ${supportedVersions.join(', ')}.`,
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

    // Normalize relay routing fields for version 2+
    parsed.hopCount = typeof parsed.hopCount === 'number' ? parsed.hopCount : 0;
    parsed.maxHops =
      typeof parsed.maxHops === 'number' ? parsed.maxHops : (BLE_PROTOCOL.RELAY_LIMITS?.DEFAULT_MAX_HOPS || 3);
    parsed.forwarderId = parsed.forwarderId || null;
    parsed.originalSenderId = parsed.originalSenderId || null;
    parsed.expiresAt = parsed.expiresAt || null;
    parsed.integrityHash = parsed.integrityHash || null;

    // Perform integrity verification if integrityHash is provided
    if (parsed.type === BLE_MESSAGE_TYPES.SOS_ALERT && parsed.integrityHash) {
      const integrityCheck = verifyAlertIntegrity(parsed);
      if (!integrityCheck.valid) {
        return {
          valid: false,
          error: integrityCheck.error,
          message: parsed,
        };
      }
    }

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
