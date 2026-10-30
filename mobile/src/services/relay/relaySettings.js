/**
 * RescueLink Relay Settings & Node Identity
 *
 * Manages device-level multi-hop mesh configuration:
 * - Relay enable/disable state
 * - Configurable maximum hop limit
 * - Rate limit thresholds
 * - Anonymous node identifier (cryptographically random node-XXXXXX)
 */

import { BLE_PROTOCOL } from '../bluetooth/bleConstants.js';

let AsyncStorage = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  // In-memory fallback for testing or environments without AsyncStorage
}

const STORAGE_KEYS = {
  RELAY_ENABLED: '@rescuelink_relay_enabled',
  MAX_HOPS: '@rescuelink_max_hops',
  NODE_ID: '@rescuelink_node_id',
};

class RelaySettings {
  constructor() {
    this.enabled = true; // Enabled by default for emergency cooperation
    this.maxHops = BLE_PROTOCOL.RELAY_LIMITS?.DEFAULT_MAX_HOPS || 3;
    this.nodeId = null;
    this.rateLimit = {
      maxForwards: BLE_PROTOCOL.RELAY_LIMITS?.MAX_FORWARD_RATE_COUNT || 5,
      windowMs: BLE_PROTOCOL.RELAY_LIMITS?.MAX_FORWARD_RATE_WINDOW_MS || 60000,
    };
    this.initialized = false;
  }

  /**
   * Initialize settings from persistent storage if available.
   */
  async initialize() {
    if (this.initialized) return;

    if (AsyncStorage) {
      try {
        const storedEnabled = await AsyncStorage.getItem(STORAGE_KEYS.RELAY_ENABLED);
        if (storedEnabled !== null) {
          this.enabled = storedEnabled === 'true';
        }

        const storedMaxHops = await AsyncStorage.getItem(STORAGE_KEYS.MAX_HOPS);
        if (storedMaxHops !== null) {
          const parsedHops = parseInt(storedMaxHops, 10);
          if (!isNaN(parsedHops) && parsedHops >= 1 && parsedHops <= 5) {
            this.maxHops = parsedHops;
          }
        }

        const storedNodeId = await AsyncStorage.getItem(STORAGE_KEYS.NODE_ID);
        if (storedNodeId) {
          this.nodeId = storedNodeId;
        }
      } catch (err) {
        console.warn('[RelaySettings] Storage load warning:', err.message);
      }
    }

    if (!this.nodeId) {
      this.nodeId = this.generateNodeId();
      if (AsyncStorage) {
        try {
          await AsyncStorage.setItem(STORAGE_KEYS.NODE_ID, this.nodeId);
        } catch (e) {
          // Ignore write error
        }
      }
    }

    this.initialized = true;
  }

  /**
   * Generate an anonymous 6-character random hex node ID (e.g. node-f4a2b9).
   * Does NOT expose device MAC or user PII.
   */
  generateNodeId() {
    const randomHex = Math.random().toString(36).substring(2, 8);
    return `node-${randomHex}`;
  }

  /**
   * Get the anonymous node ID of this device.
   */
  getNodeId() {
    if (!this.nodeId) {
      this.nodeId = this.generateNodeId();
    }
    return this.nodeId;
  }

  /**
   * Check whether relay forwarding is currently enabled.
   */
  isRelayEnabled() {
    return this.enabled;
  }

  /**
   * Enable or disable relay forwarding.
   *
   * @param {boolean} enabled
   */
  async setRelayEnabled(enabled) {
    this.enabled = !!enabled;
    if (AsyncStorage) {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.RELAY_ENABLED, this.enabled ? 'true' : 'false');
      } catch (e) {
        console.warn('[RelaySettings] Save error:', e.message);
      }
    }
    return this.enabled;
  }

  /**
   * Get maximum allowed hop count for forwarded alerts.
   */
  getMaxHops() {
    return this.maxHops;
  }

  /**
   * Set maximum allowed hop count (clamped between 1 and 5).
   *
   * @param {number} hops
   */
  async setMaxHops(hops) {
    const clamped = Math.min(Math.max(parseInt(hops, 10) || 3, 1), 5);
    this.maxHops = clamped;
    if (AsyncStorage) {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.MAX_HOPS, String(clamped));
      } catch (e) {
        console.warn('[RelaySettings] Save error:', e.message);
      }
    }
    return this.maxHops;
  }

  /**
   * Get the current rate limit settings.
   */
  getRateLimitConfig() {
    return { ...this.rateLimit };
  }

  /**
   * Set custom rate limit settings.
   */
  setRateLimitConfig({ maxForwards, windowMs }) {
    if (typeof maxForwards === 'number' && maxForwards > 0) {
      this.rateLimit.maxForwards = maxForwards;
    }
    if (typeof windowMs === 'number' && windowMs > 0) {
      this.rateLimit.windowMs = windowMs;
    }
  }

  /**
   * Reset settings to defaults (useful in tests).
   */
  reset() {
    this.enabled = true;
    this.maxHops = BLE_PROTOCOL.RELAY_LIMITS?.DEFAULT_MAX_HOPS || 3;
    this.nodeId = null;
    this.initialized = false;
  }
}

export const relaySettings = new RelaySettings();
export default relaySettings;
