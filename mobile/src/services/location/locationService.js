/**
 * Location Service Module
 *
 * Provides optional GPS coordinate acquisition for emergency alerts.
 *
 * Safety & Privacy Principles:
 * 1. Location is optional: users may send emergency distress beacons without location.
 * 2. Never invents or hardcodes fake coordinates.
 * 3. Gracefully handles permission denials, timeouts, and hardware unavailability.
 * 4. Only queries coordinates when explicitly requested by user action.
 */

class LocationService {
  /**
   * Acquire current GPS coordinates if hardware and permissions allow.
   *
   * @returns {Promise<{success: boolean, status: string, coords: {latitude: number, longitude: number}|null, error?: string}>}
   */
  async acquireLocation() {
    // Check if navigator.geolocation is available (Web / Expo Web / Hybrid)
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = Number(position.coords.latitude.toFixed(4));
            const lng = Number(position.coords.longitude.toFixed(4));
            resolve({
              success: true,
              status: 'Location attached',
              coords: {
                latitude: lat,
                longitude: lng,
              },
            });
          },
          (error) => {
            let status = 'Location unavailable';
            if (error.code === 1) {
              status = 'Permission not granted';
            }
            resolve({
              success: false,
              status,
              coords: null,
              error: error.message,
            });
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          }
        );
      });
    }

    // When native Expo location plugin or navigator is unavailable
    return {
      success: false,
      status: 'Location unavailable',
      coords: null,
      error: 'Device location provider is not accessible.',
    };
  }
}

export const locationService = new LocationService();
export default locationService;
