/**
 * RescueLink Network Connectivity Service
 *
 * Wraps @react-native-community/netinfo to detect network interface changes
 * and verify true internet reachability.
 */

let NetInfo = null;
try {
  NetInfo = require('@react-native-community/netinfo').default || require('@react-native-community/netinfo');
} catch (e) {
  // In pure Node unit test environments, NetInfo native module won't be linked
  NetInfo = null;
}

class NetworkService {
  constructor() {
    this.isConnected = true;
    this.isInternetReachable = true;
    this.connectionType = 'unknown';
    this.listeners = new Set();
    this.subscription = null;
    this.customReachabilityChecker = null;

    this.init();
  }

  init() {
    if (NetInfo && typeof NetInfo.addEventListener === 'function') {
      this.subscription = NetInfo.addEventListener((state) => {
        const wasOffline = !this.isConnected || !this.isInternetReachable;
        this.isConnected = !!state.isConnected;
        this.isInternetReachable = state.isInternetReachable !== false; // null means undetermined, treat as true until probed
        this.connectionType = state.type || 'unknown';

        const isNowOnline = this.isConnected && this.isInternetReachable;

        // Notify listeners
        this.notifyListeners({
          isConnected: this.isConnected,
          isInternetReachable: this.isInternetReachable,
          type: this.connectionType,
          wasReconnected: wasOffline && isNowOnline,
        });
      });
    }
  }

  /**
   * Check current network state and verify true internet reachability.
   * A connected Wi-Fi without internet gateway access will return false.
   */
  async checkConnectivity(healthCheckUrl = null) {
    if (this.customReachabilityChecker) {
      return this.customReachabilityChecker();
    }

    if (!NetInfo || typeof NetInfo.fetch !== 'function') {
      return {
        isConnected: this.isConnected,
        isInternetReachable: this.isInternetReachable,
        type: this.connectionType,
      };
    }

    try {
      const state = await NetInfo.fetch();
      this.isConnected = !!state.isConnected;
      this.isInternetReachable = state.isInternetReachable !== false;
      this.connectionType = state.type || 'unknown';

      // Perform optional lightweight HTTP ping to verify end-to-end reachability
      if (this.isConnected && healthCheckUrl) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(healthCheckUrl, {
            method: 'HEAD',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          this.isInternetReachable = res.ok;
        } catch (pingErr) {
          this.isInternetReachable = false;
        }
      }

      return {
        isConnected: this.isConnected,
        isInternetReachable: this.isInternetReachable,
        type: this.connectionType,
      };
    } catch (err) {
      return {
        isConnected: false,
        isInternetReachable: false,
        type: 'unknown',
        error: err.message,
      };
    }
  }

  isOnline() {
    return this.isConnected && this.isInternetReachable;
  }

  /**
   * Subscribe to network connectivity changes.
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  addConnectivityListener(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(data) {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (err) {
        console.error('[NetworkService] Listener error:', err);
      }
    }
  }

  /**
   * Set custom reachability checker (useful for testing)
   */
  setMockReachability(isOnline) {
    this.isConnected = isOnline;
    this.isInternetReachable = isOnline;
    this.notifyListeners({
      isConnected: isOnline,
      isInternetReachable: isOnline,
      type: isOnline ? 'wifi' : 'none',
      wasReconnected: isOnline,
    });
  }

  destroy() {
    if (this.subscription) {
      this.subscription();
      this.subscription = null;
    }
    this.listeners.clear();
  }
}

export const networkService = new NetworkService();
export default networkService;
