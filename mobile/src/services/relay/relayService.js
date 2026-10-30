/**
 * RescueLink Multi-Device SOS Relay Service
 *
 * Implements a controlled Bluetooth Low Energy epidemic relay protocol:
 * - Validates message integrity and payload bounds.
 * - Enforces message TTL / expiration.
 * - Detects duplicate alerts across hops.
 * - Prevents relay routing loops.
 * - Enforces maximum hop count limits.
 * - Throttles forward attempts via sliding-window rate limiting.
 * - Records full audit history to SQLite.
 */

import { AlertRepository, RelayRepository, SyncQueueRepository } from '../../database/index.js';
import {
  deserializeBLEMessage,
  serializeBLEMessage,
  buildRelayForwardPayload,
  verifyAlertIntegrity,
} from '../bluetooth/bleProtocol.js';
import { BLE_STATES } from '../bluetooth/bleConstants.js';
import { relaySettings } from './relaySettings.js';

let customBluetoothService = null;

export const setCustomBluetoothService = (service) => {
  customBluetoothService = service;
};

const resolveBluetoothService = () => {
  if (customBluetoothService) return customBluetoothService;
  try {
    const mod = require('../bluetooth/bluetoothService.js');
    return mod.bluetoothService || mod.default || null;
  } catch (e) {
    return null;
  }
};

class RelayService {
  constructor() {
    this.settings = relaySettings;
  }

  /**
   * Process an incoming SOS alert received over Bluetooth Low Energy.
   * Runs the complete relay admission control pipeline.
   *
   * @param {string|object} rawPayload - Serialized Base64 string or alert object
   * @param {string} [sourceDeviceId] - BLE MAC or identifier of the sending peer
   * @param {string} [currentUserId] - Authenticated user ID of this device
   * @returns {Promise<{ accepted: boolean, eligibleToForward: boolean, reason?: string, error?: string, alert?: object, isDuplicate?: boolean }>}
   */
  async processIncomingRelayAlert(rawPayload, sourceDeviceId = null, currentUserId = null) {
    let alert = null;

    // 1. Deserialization & Base Protocol Validation
    if (typeof rawPayload === 'string') {
      const deser = deserializeBLEMessage(rawPayload);
      if (!deser.valid) {
        return {
          accepted: false,
          eligibleToForward: false,
          reason: 'INVALID_PAYLOAD',
          error: deser.error,
        };
      }
      alert = deser.message;
    } else if (typeof rawPayload === 'object' && rawPayload !== null) {
      alert = { ...rawPayload };
    } else {
      return {
        accepted: false,
        eligibleToForward: false,
        reason: 'INVALID_PAYLOAD',
        error: 'Payload must be a non-null object or Base64 string.',
      };
    }

    const alertId = alert.alertId || alert.id;
    if (!alertId || typeof alertId !== 'string') {
      return {
        accepted: false,
        eligibleToForward: false,
        reason: 'MISSING_ALERT_ID',
        error: 'Message is missing a valid alertId.',
      };
    }

    // 2. Message Integrity Verification
    // Ensures the distress description, coordinates, and emergency type were not modified
    if (alert.integrityHash) {
      const integrity = verifyAlertIntegrity(alert);
      if (!integrity.valid) {
        await RelayRepository.recordRelayEvent({
          alertId,
          action: 'DROPPED',
          hopCount: alert.hopCount || 0,
          forwarderId: alert.forwarderId,
          previousHopId: sourceDeviceId,
          statusReason: 'INTEGRITY_MISMATCH',
          metadata: { error: integrity.error },
        });

        return {
          accepted: false,
          eligibleToForward: false,
          reason: 'INTEGRITY_MISMATCH',
          error: integrity.error,
        };
      }
    }

    // 3. Expiration / TTL Check
    if (alert.expiresAt) {
      const expiresTime = new Date(alert.expiresAt).getTime();
      if (!isNaN(expiresTime) && expiresTime <= Date.now()) {
        await RelayRepository.recordRelayEvent({
          alertId,
          action: 'DROPPED',
          hopCount: alert.hopCount || 0,
          forwarderId: alert.forwarderId,
          previousHopId: sourceDeviceId,
          statusReason: 'EXPIRED',
          metadata: { expiresAt: alert.expiresAt },
        });

        return {
          accepted: false,
          eligibleToForward: false,
          reason: 'EXPIRED',
          error: `Distress alert expired at ${alert.expiresAt}.`,
        };
      }
    }

    // 4. Loop Prevention Check
    const myNodeId = this.settings.getNodeId();

    // Check if this device is the original author
    if (
      (currentUserId && alert.originalSenderId === currentUserId) ||
      (alert.originalSenderId && alert.originalSenderId === myNodeId)
    ) {
      await RelayRepository.recordRelayEvent({
        alertId,
        action: 'DROPPED',
        hopCount: alert.hopCount || 0,
        forwarderId: alert.forwarderId,
        previousHopId: sourceDeviceId,
        statusReason: 'LOOP_DETECTED_OWN_ORIGIN',
      });

      return {
        accepted: false,
        eligibleToForward: false,
        reason: 'LOOP_DETECTED',
        error: 'Self-originated distress message received back via relay loop.',
      };
    }

    // Check if this device was the previous forwarder
    if (alert.forwarderId && alert.forwarderId === myNodeId) {
      await RelayRepository.recordRelayEvent({
        alertId,
        action: 'DROPPED',
        hopCount: alert.hopCount || 0,
        forwarderId: alert.forwarderId,
        previousHopId: sourceDeviceId,
        statusReason: 'LOOP_DETECTED_PREVIOUS_FORWARDER',
      });

      return {
        accepted: false,
        eligibleToForward: false,
        reason: 'LOOP_DETECTED',
        error: 'Message was previously forwarded by this device.',
      };
    }

    // Check if this device already forwarded this alert in the past
    const hasAlreadyForwarded = await RelayRepository.hasAlreadyForwarded(alertId);
    if (hasAlreadyForwarded) {
      await RelayRepository.recordRelayEvent({
        alertId,
        action: 'DROPPED',
        hopCount: alert.hopCount || 0,
        forwarderId: alert.forwarderId,
        previousHopId: sourceDeviceId,
        statusReason: 'ALREADY_FORWARDED',
      });

      return {
        accepted: false,
        eligibleToForward: false,
        reason: 'ALREADY_FORWARDED',
        error: 'Alert has already been forwarded by this node.',
      };
    }

    // 5. Duplicate Detection Check in SQLite
    const existingAlert = await AlertRepository.getAlertById(alertId);
    if (existingAlert) {
      // If alert already saved, drop further relaying to prevent packet flooding
      await RelayRepository.recordRelayEvent({
        alertId,
        action: 'DROPPED',
        hopCount: alert.hopCount || 0,
        forwarderId: alert.forwarderId,
        previousHopId: sourceDeviceId,
        statusReason: 'DUPLICATE_ALERT',
      });

      return {
        accepted: true,
        isDuplicate: true,
        eligibleToForward: false,
        reason: 'DUPLICATE_ALERT',
        alert: existingAlert,
      };
    }

    // 6. Relay Disabled Check
    if (!this.settings.isRelayEnabled()) {
      // Still persist alert locally so responder can see it and sync to cloud
      const saved = await this.persistReceivedAlert({
        alert,
        sourceDeviceId,
        relayStatus: 'dropped_disabled',
      });

      await RelayRepository.recordRelayEvent({
        alertId,
        action: 'DROPPED',
        hopCount: alert.hopCount || 0,
        forwarderId: alert.forwarderId,
        previousHopId: sourceDeviceId,
        statusReason: 'RELAY_DISABLED',
      });

      return {
        accepted: true,
        isDuplicate: false,
        eligibleToForward: false,
        reason: 'RELAY_DISABLED',
        alert: saved,
      };
    }

    // 7. Maximum Hop Count Enforcement
    const maxAllowedHops = Math.min(
      typeof alert.maxHops === 'number' ? alert.maxHops : 3,
      this.settings.getMaxHops()
    );

    const currentHops = typeof alert.hopCount === 'number' ? alert.hopCount : 0;
    if (currentHops >= maxAllowedHops) {
      const saved = await this.persistReceivedAlert({
        alert,
        sourceDeviceId,
        relayStatus: 'dropped_hop_limit',
      });

      await RelayRepository.recordRelayEvent({
        alertId,
        action: 'DROPPED',
        hopCount: currentHops,
        forwarderId: alert.forwarderId,
        previousHopId: sourceDeviceId,
        statusReason: 'HOP_LIMIT_REACHED',
        metadata: { currentHops, maxAllowedHops },
      });

      return {
        accepted: true,
        isDuplicate: false,
        eligibleToForward: false,
        reason: 'HOP_LIMIT_REACHED',
        alert: saved,
      };
    }

    // 8. Alert Admitted & Eligible for Forwarding!
    const savedAlert = await this.persistReceivedAlert({
      alert,
      sourceDeviceId,
      relayStatus: 'eligible',
    });

    await RelayRepository.recordRelayEvent({
      alertId,
      action: 'RECEIVED',
      hopCount: currentHops,
      forwarderId: alert.forwarderId,
      previousHopId: sourceDeviceId,
      statusReason: 'ADMITTED',
      metadata: {
        originalSenderId: alert.originalSenderId || null,
        expiresAt: alert.expiresAt || null,
      },
    });

    return {
      accepted: true,
      isDuplicate: false,
      eligibleToForward: true,
      alert: savedAlert,
    };
  }

  /**
   * Helper to persist an admitted or dropped alert to SQLite and enqueue for cloud sync.
   */
  async persistReceivedAlert({ alert, sourceDeviceId, relayStatus }) {
    const alertId = alert.alertId || alert.id;
    const saveResult = await AlertRepository.saveOrUpdateAlert({
      alertId,
      senderName: alert.senderName || 'Anonymous Survivor',
      emergencyType: alert.emergencyType,
      details: alert.details,
      latitude: alert.latitude,
      longitude: alert.longitude,
      source: 'bluetooth',
      deliveryStatus: 'received',
      ackStatus: 'unacknowledged',
      syncStatus: 'pending_sync',
      createdAt: alert.createdAt,
      hopCount: alert.hopCount || 0,
      maxHops: alert.maxHops || 3,
      forwarderId: alert.forwarderId || sourceDeviceId || null,
      originalSenderId: alert.originalSenderId || null,
      expiresAt: alert.expiresAt || null,
      relayStatus,
      integrityHash: alert.integrityHash || null,
    });

    // Enqueue in offline outbox for cloud sync when connection returns
    try {
      await SyncQueueRepository.enqueue({
        alertId,
        operation: 'CREATE',
        payload: {
          alertId,
          emergencyType: alert.emergencyType,
          details: alert.details,
          latitude: alert.latitude,
          longitude: alert.longitude,
          source: 'bluetooth',
          originalSenderName: alert.senderName,
          hopCount: alert.hopCount || 0,
          forwarderId: alert.forwarderId || sourceDeviceId || null,
          originalSenderId: alert.originalSenderId || null,
          createdAt: alert.createdAt,
        },
      });
    } catch (qErr) {
      console.warn('[RelayService] Outbox queue warning:', qErr.message);
    }

    return saveResult.alert;
  }

  /**
   * Forward an eligible distress alert to nearby BLE peers.
   * Enforces rate limiting, builds the incremented hop payload, and records the event.
   *
   * @param {string|object} alertOrId - Alert record or alertId
   * @returns {Promise<{ success: boolean, reason?: string, error?: string, forwardPayload?: object }>}
   */
  async forwardAlert(alertOrId) {
    let alert = null;
    if (typeof alertOrId === 'string') {
      alert = await AlertRepository.getAlertById(alertOrId);
    } else if (typeof alertOrId === 'object' && alertOrId !== null) {
      alert = alertOrId;
    }

    if (!alert) {
      return { success: false, reason: 'ALERT_NOT_FOUND', error: 'Distress alert not found.' };
    }

    const alertId = alert.alertId || alert.id;

    // 1. Relay Enabled Check
    if (!this.settings.isRelayEnabled()) {
      return { success: false, reason: 'RELAY_DISABLED', error: 'Mesh relay is currently disabled in settings.' };
    }

    // 2. Expiration Check
    if (alert.expiresAt) {
      const expiresTime = new Date(alert.expiresAt).getTime();
      if (!isNaN(expiresTime) && expiresTime <= Date.now()) {
        return { success: false, reason: 'EXPIRED', error: 'Cannot forward an expired distress alert.' };
      }
    }

    // 3. Hop Limit Check
    const currentHops = typeof alert.hopCount === 'number' ? alert.hopCount : 0;
    const maxAllowedHops = Math.min(
      typeof alert.maxHops === 'number' ? alert.maxHops : 3,
      this.settings.getMaxHops()
    );

    if (currentHops >= maxAllowedHops) {
      return {
        success: false,
        reason: 'HOP_LIMIT_REACHED',
        error: `Hop count (${currentHops}) has reached maximum limit (${maxAllowedHops}).`,
      };
    }

    // 4. Duplicate / Loop Check
    const alreadyForwarded = await RelayRepository.hasAlreadyForwarded(alertId);
    if (alreadyForwarded) {
      return {
        success: false,
        reason: 'ALREADY_FORWARDED',
        error: 'This alert has already been forwarded by this device.',
      };
    }

    // 5. Forwarding Rate Limit Enforcement
    const rateConfig = this.settings.getRateLimitConfig();
    const windowStart = new Date(Date.now() - rateConfig.windowMs).toISOString();
    const recentCount = await RelayRepository.getRecentForwardCount(windowStart);

    if (recentCount >= rateConfig.maxForwards) {
      await RelayRepository.recordRelayEvent({
        alertId,
        action: 'DROPPED',
        hopCount: currentHops,
        forwarderId: this.settings.getNodeId(),
        statusReason: 'RATE_LIMIT_EXCEEDED',
        metadata: { recentCount, maxForwards: rateConfig.maxForwards },
      });

      return {
        success: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        error: `Relay rate limit reached (${recentCount}/${rateConfig.maxForwards} forwards per minute). Throttling to conserve radio.`,
      };
    }

    // 6. Build Immutable Relay Forward Payload with Incremented Hop
    const myNodeId = this.settings.getNodeId();
    let forwardPayload = null;
    let serialized = null;

    try {
      forwardPayload = buildRelayForwardPayload(alert, myNodeId);
      serialized = serializeBLEMessage(forwardPayload);
    } catch (buildErr) {
      return {
        success: false,
        reason: 'PAYLOAD_BUILD_ERROR',
        error: buildErr.message,
      };
    }

    // 7. BLE Broadcast
    let bleResult = null;
    const ble = resolveBluetoothService();
    if (ble && typeof ble.startAdvertisingSOS === 'function') {
      try {
        bleResult = await ble.startAdvertisingSOS(forwardPayload);
      } catch (bleErr) {
        console.warn('[RelayService] BLE Advertising warning (hardware or bridge limit):', bleErr.message);
      }
    }

    // 8. Persist Updated Relay Status in SQLite
    const nowIso = new Date().toISOString();
    await AlertRepository.updateRelayStatus(alertId, 'forwarded', nowIso);

    // 9. Record FORWARDED event in Relay History
    await RelayRepository.recordRelayEvent({
      alertId,
      action: 'FORWARDED',
      hopCount: forwardPayload.hopCount,
      forwarderId: myNodeId,
      statusReason: 'FORWARDED_VIA_BLE',
      timestamp: nowIso,
      metadata: {
        serializedLength: serialized.length,
        bleBroadcastSuccess: bleResult?.success || false,
      },
    });

    return {
      success: true,
      forwardPayload,
      serializedLength: serialized.length,
      bleResult,
    };
  }

  /**
   * Retrieve aggregate relay statistics.
   */
  async getRelayStats() {
    return RelayRepository.getRelayStats();
  }

  /**
   * Retrieve eligible alerts for forwarding.
   */
  async getRelayEligibleAlerts() {
    return AlertRepository.getRelayEligibleAlerts({ maxHops: this.settings.getMaxHops() });
  }
}

export const relayService = new RelayService();
export default relayService;
