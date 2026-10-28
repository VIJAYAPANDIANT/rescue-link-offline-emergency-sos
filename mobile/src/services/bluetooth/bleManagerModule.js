/**
 * Safe Native BleManager Provider
 *
 * Encapsulates react-native-ble-plx instantiation.
 * Gracefully detects when native BLE modules are absent (e.g. running inside Expo Go
 * without prebuild, on web, or in a headless simulator) without throwing uncaught exceptions.
 */

import { NativeModules, Platform } from 'react-native';

let bleManagerInstance = null;
let isNativeModuleAvailable = null;

export const checkIsNativeBleAvailable = () => {
  if (isNativeModuleAvailable !== null) {
    return isNativeModuleAvailable;
  }

  if (Platform.OS === 'web') {
    isNativeModuleAvailable = false;
    return false;
  }

  // Check if NativeModules includes BleClientManager (Android/iOS)
  const hasNativeBridge = !!(
    NativeModules.BleClientManager ||
    NativeModules.RNBLE ||
    NativeModules.BleManager
  );

  isNativeModuleAvailable = hasNativeBridge;
  return isNativeModuleAvailable;
};

/**
 * Returns the singleton BleManager instance if native bridge is linked.
 * Returns null if running in Expo Go or environment without native modules.
 */
export const getBleManagerInstance = () => {
  if (bleManagerInstance) {
    return bleManagerInstance;
  }

  if (!checkIsNativeBleAvailable()) {
    console.warn(
      '[RescueLink BLE] Native BleClientManager bridge not found. BLE hardware features require an Expo Development Build (npx expo run:android).'
    );
    return null;
  }

  try {
    const { BleManager } = require('react-native-ble-plx');
    bleManagerInstance = new BleManager();
    return bleManagerInstance;
  } catch (err) {
    console.warn('[RescueLink BLE] Failed to instantiate react-native-ble-plx BleManager:', err.message);
    isNativeModuleAvailable = false;
    return null;
  }
};

/**
 * Cleanup and destroy BleManager resources.
 */
export const destroyBleManagerInstance = () => {
  if (bleManagerInstance) {
    try {
      bleManagerInstance.destroy();
    } catch (e) {
      // Ignore cleanup error
    }
    bleManagerInstance = null;
  }
};
