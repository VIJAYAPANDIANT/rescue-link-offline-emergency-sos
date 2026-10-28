/**
 * RescueLink BLE Permissions Manager
 *
 * Handles native runtime permission requests across Android versions (Android 12+ vs Android 6-11)
 * and iOS without crashing or prompting prematurely.
 */

import { Platform, PermissionsAndroid } from 'react-native';

export class BlePermissionsManager {
  /**
   * Request Bluetooth scanning and connection permissions.
   *
   * Android Architecture:
   * - API 31+ (Android 12+): BLUETOOTH_SCAN, BLUETOOTH_CONNECT, and optionally BLUETOOTH_ADVERTISE.
   * - API 23-30 (Android 6-11): ACCESS_FINE_LOCATION is mandatory by Android OS for BLE scanning.
   * - iOS: CoreBluetooth prompts automatically on first manager initialization.
   */
  static async requestBluetoothPermissions({ needAdvertise = false } = {}) {
    if (Platform.OS === 'web') {
      return {
        granted: false,
        reason: 'Web Bluetooth API is not natively bound in standard React Native web bundles.',
      };
    }

    if (Platform.OS === 'ios') {
      // iOS handles runtime dialog via Info.plist NSBluetoothAlwaysUsageDescription
      return { granted: true };
    }

    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version;

        if (apiLevel >= 31) {
          // Android 12+ (API 31+) permissions
          const permissionsToRequest = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ];

          if (needAdvertise && PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE) {
            permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE);
          }

          const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);

          const scanGranted =
            results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
            PermissionsAndroid.RESULTS.GRANTED;
          const connectGranted =
            results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
            PermissionsAndroid.RESULTS.GRANTED;
          const advGranted =
            !needAdvertise ||
            results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE] ===
              PermissionsAndroid.RESULTS.GRANTED;

          const allGranted = scanGranted && connectGranted && advGranted;

          return {
            granted: allGranted,
            details: results,
            reason: allGranted
              ? null
              : 'Bluetooth scan, connect, or advertise permission was denied.',
          };
        } else {
          // Android 6 - 11 (API 23 - 30) requires Location permission for BLE scanning
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission for BLE Scanning',
              message:
                'Android versions below 12 require location permission to discover nearby Bluetooth Low Energy devices.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );

          return {
            granted: granted === PermissionsAndroid.RESULTS.GRANTED,
            reason:
              granted === PermissionsAndroid.RESULTS.GRANTED
                ? null
                : 'Fine location permission is required by Android to discover nearby BLE devices.',
          };
        }
      } catch (err) {
        return {
          granted: false,
          reason: `Permission request failed: ${err.message}`,
        };
      }
    }

    return { granted: false, reason: 'Unsupported platform.' };
  }
}

export default BlePermissionsManager;
