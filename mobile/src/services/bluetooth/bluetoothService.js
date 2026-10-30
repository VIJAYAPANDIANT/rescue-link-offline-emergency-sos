/**
 * RescueLink Unified Bluetooth Low Energy Service
 *
 * Coordinates Central (Receiver) and Peripheral (Sender) BLE capabilities,
 * permission management, and state reporting.
 */

import { bleCentralService } from './bleCentralService.js';
import { blePeripheralService } from './blePeripheralService.js';
import { BlePermissionsManager } from './blePermissions.js';
import {
  RESCUELINK_SERVICE_UUID,
  SOS_ALERT_CHAR_UUID,
  SOS_ACK_CHAR_UUID,
  BLE_STATES,
  BLE_PROTOCOL,
} from './bleConstants.js';

class BluetoothService {
  constructor() {
    this.central = bleCentralService;
    this.peripheral = blePeripheralService;
  }

  /**
   * Request Bluetooth permissions for Central scanning or Peripheral advertising.
   */
  async requestPermissions(options = {}) {
    return BlePermissionsManager.requestBluetoothPermissions(options);
  }

  /**
   * Check whether Bluetooth hardware and native modules are available.
   */
  async checkBluetoothAvailability() {
    return this.central.checkSupport();
  }

  /**
   * Sender Role: Broadcast an emergency SOS alert as a BLE Peripheral.
   */
  async startAdvertisingSOS(alertData, onAckReceived) {
    return this.peripheral.startAdvertisingSOS(alertData, onAckReceived);
  }

  /**
   * Sender Role: Stop BLE advertising and release GATT server resources.
   */
  async stopAdvertisingSOS() {
    return this.peripheral.stopAdvertising();
  }

  /**
   * Receiver Role: Scan for nearby RescueLink SOS peripheral broadcasters.
   */
  async startScanningForSenders(callbacks) {
    return this.central.startScan(callbacks);
  }

  /**
   * Receiver Role: Stop active BLE scan.
   */
  stopScanning() {
    return this.central.stopScan();
  }

  /**
   * Receiver Role: Connect to a discovered sender device and read distress alert.
   */
  async connectAndReceiveAlert(deviceId, onAlertReceived) {
    return this.central.connectAndReceiveAlert(deviceId, onAlertReceived);
  }

  /**
   * Receiver Role: Transmit a genuine acknowledgment back to sender over BLE.
   */
  async sendAcknowledgment(deviceId, alertId) {
    return this.central.sendAcknowledgment(deviceId, alertId);
  }

  /**
   * Disconnect active device.
   */
  async disconnectDevice(deviceId) {
    return this.central.disconnectDevice(deviceId);
  }
}

export const bluetoothService = new BluetoothService();
export {
  RESCUELINK_SERVICE_UUID,
  SOS_ALERT_CHAR_UUID,
  SOS_ACK_CHAR_UUID,
  BLE_STATES,
  BLE_PROTOCOL,
};
export default bluetoothService;
