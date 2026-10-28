/**
 * RescueLink BLE Central Service (Receiver Role)
 *
 * Implements scanning, connecting, service discovery, alert reception,
 * and acknowledgment transmission over Bluetooth Low Energy.
 */

import { Platform } from 'react-native';
import { getBleManagerInstance, checkIsNativeBleAvailable } from './bleManagerModule';
import { BlePermissionsManager } from './blePermissions';
import {
  RESCUELINK_SERVICE_UUID,
  SOS_ALERT_CHAR_UUID,
  SOS_ACK_CHAR_UUID,
  BLE_STATES,
  BLE_PROTOCOL,
} from './bleConstants';
import {
  deserializeBLEMessage,
  buildSOSAcknowledgePayload,
  serializeBLEMessage,
} from './bleProtocol';

class BleCentralService {
  constructor() {
    this.isScanning = false;
    this.scanTimeoutTimer = null;
    this.discoveredDevicesMap = new Map();
    this.activeDeviceConnection = null;
    this.processedAlertIds = new Set();
    this.receiverNodeId = `rx-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Check if Central BLE scanning is hardware and bridge supported.
   */
  async checkSupport() {
    const isAvailable = checkIsNativeBleAvailable();
    if (!isAvailable) {
      return {
        supported: false,
        state: BLE_STATES.UNAVAILABLE,
        message: 'Native BLE module requires an Expo development build (npx expo run:android). Not supported in Expo Go.',
      };
    }

    const manager = getBleManagerInstance();
    if (!manager) {
      return {
        supported: false,
        state: BLE_STATES.UNAVAILABLE,
        message: 'BleManager initialization failed.',
      };
    }

    try {
      const state = await manager.state();
      return {
        supported: true,
        state: state === 'PoweredOn' ? BLE_STATES.IDLE : BLE_STATES.BLUETOOTH_OFF,
        bluetoothState: state,
      };
    } catch (err) {
      return {
        supported: false,
        state: BLE_STATES.ERROR,
        message: err.message,
      };
    }
  }

  /**
   * Start scanning for nearby RescueLink SOS peripheral broadcasters.
   *
   * @param {object} callbacks
   * @param {Function} callbacks.onDeviceFound - Invoked when a real compatible device is discovered
   * @param {Function} callbacks.onError - Invoked on scan error
   * @param {Function} callbacks.onScanStopped - Invoked when scan completes or stops
   */
  async startScan({ onDeviceFound, onError, onScanStopped } = {}) {
    if (this.isScanning) {
      return { success: true, message: 'Scan already in progress.' };
    }

    // 1. Request permissions
    const permResult = await BlePermissionsManager.requestBluetoothPermissions();
    if (!permResult.granted) {
      const errMsg = permResult.reason || 'Bluetooth permissions denied.';
      if (onError) onError(new Error(errMsg));
      return { success: false, state: BLE_STATES.PERMISSION_REQUIRED, error: errMsg };
    }

    const manager = getBleManagerInstance();
    if (!manager) {
      const errMsg = 'Native BLE module not linked in this build.';
      if (onError) onError(new Error(errMsg));
      return { success: false, state: BLE_STATES.UNAVAILABLE, error: errMsg };
    }

    // 2. Verify Bluetooth power state
    const bleState = await manager.state();
    if (bleState !== 'PoweredOn') {
      const errMsg = `Bluetooth is currently ${bleState}. Please enable Bluetooth on your device.`;
      if (onError) onError(new Error(errMsg));
      return { success: false, state: BLE_STATES.BLUETOOTH_OFF, error: errMsg };
    }

    this.isScanning = true;
    this.discoveredDevicesMap.clear();

    // Set automatic scan timeout (30 seconds)
    if (this.scanTimeoutTimer) clearTimeout(this.scanTimeoutTimer);
    this.scanTimeoutTimer = setTimeout(() => {
      this.stopScan();
      if (onScanStopped) onScanStopped();
    }, BLE_PROTOCOL.DEFAULT_SCAN_TIMEOUT_MS);

    try {
      // Filter by RescueLink custom Service UUID
      manager.startDeviceScan(
        [RESCUELINK_SERVICE_UUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('[BLE Central] Scan error:', error.message);
            this.stopScan();
            if (onError) onError(error);
            return;
          }

          if (device) {
            // Deduplicate devices by MAC address or UUID
            if (!this.discoveredDevicesMap.has(device.id)) {
              const deviceInfo = {
                id: device.id,
                name: device.name || device.localName || 'RescueLink Sender',
                rssi: device.rssi,
                serviceUUIDs: device.serviceUUIDs || [],
                discoveredAt: new Date().toISOString(),
                rawDevice: device,
              };

              this.discoveredDevicesMap.set(device.id, deviceInfo);

              if (onDeviceFound) {
                onDeviceFound(deviceInfo);
              }
            }
          }
        }
      );

      return { success: true, state: BLE_STATES.SCANNING };
    } catch (err) {
      this.isScanning = false;
      if (onError) onError(err);
      return { success: false, state: BLE_STATES.ERROR, error: err.message };
    }
  }

  /**
   * Stop any active device scan.
   */
  stopScan() {
    if (this.scanTimeoutTimer) {
      clearTimeout(this.scanTimeoutTimer);
      this.scanTimeoutTimer = null;
    }

    const manager = getBleManagerInstance();
    if (manager && this.isScanning) {
      try {
        manager.stopDeviceScan();
      } catch (e) {
        // Ignore stop errors
      }
    }

    this.isScanning = false;
    return { success: true, state: BLE_STATES.IDLE };
  }

  /**
   * Connect to a discovered sender device and read its emergency distress alert.
   *
   * @param {string} deviceId
   * @param {Function} [onAlertReceived]
   */
  async connectAndReceiveAlert(deviceId, onAlertReceived) {
    const manager = getBleManagerInstance();
    if (!manager) {
      throw new Error('Native BLE module is unavailable.');
    }

    // Stop scan prior to initiating GATT connection for connection stability
    this.stopScan();

    try {
      // 1. Establish GATT connection
      const connectedDevice = await manager.connectToDevice(deviceId, {
        autoConnect: false,
        timeout: BLE_PROTOCOL.CONNECT_TIMEOUT_MS,
      });

      this.activeDeviceConnection = connectedDevice;

      // 2. Request high MTU on Android (512 bytes)
      if (Platform.OS === 'android') {
        try {
          await connectedDevice.requestMTU(512);
        } catch (mtuErr) {
          console.warn('[BLE Central] MTU request warning (falling back to default):', mtuErr.message);
        }
      }

      // 3. Discover custom services and characteristics
      await connectedDevice.discoverAllServicesAndCharacteristics();

      // 4. Read SOS Alert Characteristic
      const characteristic = await connectedDevice.readCharacteristicForService(
        RESCUELINK_SERVICE_UUID,
        SOS_ALERT_CHAR_UUID
      );

      if (!characteristic || !characteristic.value) {
        throw new Error('SOS characteristic read returned empty payload.');
      }

      // 5. Deserialize & validate message
      const result = deserializeBLEMessage(characteristic.value);
      if (!result.valid) {
        throw new Error(`Protocol Validation Error: ${result.error}`);
      }

      const alertMessage = result.message;

      // Check duplicate alertId
      const isDuplicate = this.processedAlertIds.has(alertMessage.alertId);
      if (!isDuplicate) {
        this.processedAlertIds.add(alertMessage.alertId);
      }

      const alertData = {
        ...alertMessage,
        isDuplicate,
        receivedVia: 'Bluetooth Low Energy',
        deviceId: connectedDevice.id,
        deviceName: connectedDevice.name || 'Nearby RescueLink Node',
      };

      if (onAlertReceived) {
        onAlertReceived(alertData);
      }

      return {
        success: true,
        alert: alertData,
        device: connectedDevice,
      };
    } catch (err) {
      console.error('[BLE Central] Connection or read failed:', err.message);
      throw err;
    }
  }

  /**
   * Transmit a genuine SOS_ACK message back to the sender peripheral.
   *
   * @param {string} deviceId
   * @param {string} alertId
   */
  async sendAcknowledgment(deviceId, alertId) {
    const manager = getBleManagerInstance();
    if (!manager) {
      throw new Error('Native BLE module is unavailable.');
    }

    if (!alertId) {
      throw new Error('Missing alertId for acknowledgment.');
    }

    try {
      const ackPayload = buildSOSAcknowledgePayload({
        alertId,
        receiverId: this.receiverNodeId,
      });

      const serializedAck = serializeBLEMessage(ackPayload);

      // Write ACK with response to guarantee delivery confirmation over GATT
      await manager.writeCharacteristicWithResponseForDevice(
        deviceId,
        RESCUELINK_SERVICE_UUID,
        SOS_ACK_CHAR_UUID,
        serializedAck
      );

      return {
        success: true,
        state: BLE_STATES.ACK_SENT,
        ackData: ackPayload,
      };
    } catch (err) {
      console.error('[BLE Central] Failed to transmit ACK to sender:', err.message);
      throw new Error(`Acknowledgment transmission failed: ${err.message}`);
    }
  }

  /**
   * Disconnect and release device connection.
   */
  async disconnectDevice(deviceId) {
    const manager = getBleManagerInstance();
    if (manager && deviceId) {
      try {
        await manager.cancelDeviceConnection(deviceId);
      } catch (e) {
        // Ignore disconnect errors
      }
    }
    this.activeDeviceConnection = null;
  }
}

export const bleCentralService = new BleCentralService();
export default bleCentralService;
