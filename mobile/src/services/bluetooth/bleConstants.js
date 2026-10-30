/**
 * RescueLink BLE Configuration & Constants
 *
 * Defines shared 128-bit Service and Characteristic UUIDs,
 * protocol constants, MTU limits, and operational state enums.
 */

// Custom 128-bit UUIDs for RescueLink Emergency Mesh Protocol
export const RESCUELINK_SERVICE_UUID = 'e0a90001-b5a3-f393-e0a9-e50e24dcca9e';
export const SOS_ALERT_CHAR_UUID = 'e0a90002-b5a3-f393-e0a9-e50e24dcca9e'; // Read / Notify (Sender -> Receiver)
export const SOS_ACK_CHAR_UUID = 'e0a90003-b5a3-f393-e0a9-e50e24dcca9e';   // Write / Notify (Receiver -> Sender)

// Protocol Parameters
export const BLE_PROTOCOL = {
  VERSION: 2,
  SUPPORTED_VERSIONS: [1, 2],
  // 512 bytes is the standard maximum characteristic payload across modern Android BLE stacks
  MAX_PAYLOAD_BYTES: 512,
  DEFAULT_SCAN_TIMEOUT_MS: 30000, // 30s auto-scan stop to conserve battery
  CONNECT_TIMEOUT_MS: 15000,
  // Multi-Device Relay Parameters
  RELAY_LIMITS: {
    DEFAULT_MAX_HOPS: 3,
    ABSOLUTE_MAX_HOPS: 5,
    DEFAULT_TTL_HOURS: 24,
    MAX_FORWARD_RATE_COUNT: 5,
    MAX_FORWARD_RATE_WINDOW_MS: 60000, // 1 minute sliding window
  },
};

// Valid Message Types
export const BLE_MESSAGE_TYPES = {
  SOS_ALERT: 'SOS_ALERT',
  SOS_ACK: 'SOS_ACK',
};

// BLE Lifecycle States
export const BLE_STATES = {
  IDLE: 'IDLE',
  PERMISSION_REQUIRED: 'PERMISSION_REQUIRED',
  BLUETOOTH_OFF: 'BLUETOOTH_OFF',
  UNAVAILABLE: 'UNAVAILABLE',
  SCANNING: 'SCANNING',
  DEVICE_FOUND: 'DEVICE_FOUND',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  ADVERTISING: 'ADVERTISING',
  SENDING: 'SENDING',
  SENT: 'SENT',
  RECEIVING: 'RECEIVING',
  RECEIVED: 'RECEIVED',
  ACK_SENT: 'ACK_SENT',
  ACK_RECEIVED: 'ACK_RECEIVED',
  DISCONNECTING: 'DISCONNECTING',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
};
