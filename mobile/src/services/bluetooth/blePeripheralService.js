/**
 * RescueLink BLE Peripheral Service (Sender Role)
 *
 * Implements BLE peripheral advertising and GATT Server hosting.
 * Allows nearby RescueLink receivers to discover the sender, read the SOS alert,
 * and write an acknowledgment message.
 */

import { NativeModules, Platform } from 'react-native';
import { BlePermissionsManager } from './blePermissions';
import {
  RESCUELINK_SERVICE_UUID,
  SOS_ALERT_CHAR_UUID,
  SOS_ACK_CHAR_UUID,
  BLE_STATES,
} from './bleConstants';
import {
  buildSOSAlertPayload,
  serializeBLEMessage,
  deserializeBLEMessage,
} from './bleProtocol';

class BlePeripheralService {
  constructor() {
    this.isAdvertising = false;
    this.currentAlert = null;
    this.onAckReceivedCallback = null;
    this.nativePeripheral = null;
    this.isInitialized = false;
  }

  /**
   * Check if native BLE peripheral advertising is supported on this device/runtime.
   */
  checkSupport() {
    if (Platform.OS === 'web') {
      return {
        supported: false,
        message: 'Web platform does not support BLE Peripheral advertising.',
      };
    }

    // Check for native bridge
    const hasBridge = !!(
      NativeModules.BlePeripheral ||
      NativeModules.RNBlePeripheral ||
      NativeModules.BLEPeripheral
    );

    if (!hasBridge) {
      return {
        supported: false,
        message:
          'Native BLE Peripheral advertising module requires an Expo development build (npx expo run:android). Not supported in Expo Go.',
      };
    }

    return { supported: true };
  }

  /**
   * Resolve native peripheral module if linked
   */
  getNativeModule() {
    if (this.nativePeripheral) return this.nativePeripheral;

    const support = this.checkSupport();
    if (!support.supported) return null;

    try {
      const peripheral = require('react-native-ble-peripheral').default || require('react-native-ble-peripheral');
      this.nativePeripheral = peripheral;
      return this.nativePeripheral;
    } catch (e) {
      console.warn('[BLE Peripheral] react-native-ble-peripheral bridge error:', e.message);
      return null;
    }
  }

  /**
   * Start advertising the emergency SOS distress alert over BLE.
   *
   * @param {object} alertData - Distress alert object
   * @param {Function} [onAckReceived] - Callback invoked when receiver sends ACK
   */
  async startAdvertisingSOS(alertData, onAckReceived) {
    if (!alertData || !alertData.id) {
      throw new Error('Valid alertData with an id is required to broadcast SOS over BLE.');
    }

    this.currentAlert = alertData;
    this.onAckReceivedCallback = onAckReceived;

    // 1. Request advertising permissions (Android 12+ BLUETOOTH_ADVERTISE)
    const permResult = await BlePermissionsManager.requestBluetoothPermissions({
      needAdvertise: true,
    });

    if (!permResult.granted) {
      return {
        success: false,
        state: BLE_STATES.PERMISSION_REQUIRED,
        error: permResult.reason || 'Bluetooth advertise permission denied.',
      };
    }

    // 2. Check native module bridge
    const peripheral = this.getNativeModule();
    if (!peripheral) {
      const support = this.checkSupport();
      return {
        success: false,
        state: BLE_STATES.UNAVAILABLE,
        error: support.message,
      };
    }

    // 3. Serialize SOS Alert payload
    const sosPayload = buildSOSAlertPayload({
      alertId: alertData.alertId || alertData.id,
      emergencyType: alertData.emergencyType,
      details: alertData.details,
      senderName: alertData.senderName,
      latitude: alertData.location?.latitude ?? alertData.latitude ?? null,
      longitude: alertData.location?.longitude ?? alertData.longitude ?? null,
      createdAt: alertData.createdAt,
      originalSenderId: alertData.originalSenderId || alertData.senderId || null,
      forwarderId: alertData.forwarderId || null,
      hopCount: typeof alertData.hopCount === 'number' ? alertData.hopCount : 0,
      maxHops: typeof alertData.maxHops === 'number' ? alertData.maxHops : 3,
      expiresAt: alertData.expiresAt || null,
      integrityHash: alertData.integrityHash || null,
    });

    const serializedPayload = serializeBLEMessage(sosPayload);

    try {
      // 4. Initialize peripheral GATT server and characteristics
      // Add Service
      await peripheral.addService(RESCUELINK_SERVICE_UUID, true);

      // Add SOS Alert Characteristic (Readable by receivers)
      // Permissions: 0x01 (Readable), Properties: 0x02 (Read) | 0x10 (Notify)
      await peripheral.addCharacteristicToService(
        RESCUELINK_SERVICE_UUID,
        SOS_ALERT_CHAR_UUID,
        1, // Permission: Readable
        18, // Properties: Read (2) | Notify (16)
        serializedPayload
      );

      // Add SOS ACK Characteristic (Writable by receivers)
      // Permissions: 0x02 (Writeable), Properties: 0x08 (Write)
      await peripheral.addCharacteristicToService(
        RESCUELINK_SERVICE_UUID,
        SOS_ACK_CHAR_UUID,
        2, // Permission: Writeable
        8, // Properties: Write
        null
      );

      // Set advertised local name
      await peripheral.setName('RescueLink-SOS');

      // 5. Start BLE advertising
      await peripheral.start();
      this.isAdvertising = true;

      return {
        success: true,
        state: BLE_STATES.ADVERTISING,
        serviceUUID: RESCUELINK_SERVICE_UUID,
        alertId: alertData.id,
      };
    } catch (err) {
      console.error('[BLE Peripheral] Failed to start advertising:', err.message);
      this.isAdvertising = false;
      return {
        success: false,
        state: BLE_STATES.ERROR,
        error: `BLE advertising failed: ${err.message}`,
      };
    }
  }

  /**
   * Process an incoming acknowledgment written to the ACK characteristic.
   *
   * @param {string} rawAckData - Serialized ACK message
   */
  handleIncomingAck(rawAckData) {
    const result = deserializeBLEMessage(rawAckData);

    if (result.valid && result.message.type === 'SOS_ACK') {
      const ack = result.message;

      // Verify that this ACK belongs to the currently active alert
      if (this.currentAlert && ack.alertId === this.currentAlert.id) {
        if (typeof this.onAckReceivedCallback === 'function') {
          this.onAckReceivedCallback(ack);
        }
        return { success: true, ack };
      }
    }

    return { success: false, error: 'ACK does not match active alert or is invalid.' };
  }

  /**
   * Stop BLE advertising and release GATT server resources.
   */
  async stopAdvertising() {
    const peripheral = this.getNativeModule();
    if (peripheral && this.isAdvertising) {
      try {
        await peripheral.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }

    this.isAdvertising = false;
    this.currentAlert = null;
    this.onAckReceivedCallback = null;

    return { success: true, state: BLE_STATES.IDLE };
  }
}

export const blePeripheralService = new BlePeripheralService();
export default blePeripheralService;
