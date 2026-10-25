/**
 * Location Service Module
 * Handles GPS coordinate acquisition and location availability indicators.
 */

class LocationService {
  constructor() {
    this.cachedLocation = {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 8.5,
      timestamp: new Date().toISOString(),
      isSimulated: true,
    };
  }

  /**
   * Acquire current GPS coordinates
   * In Step 1, returns safe demonstration GPS coordinates.
   * Native expo-location permission requests will trigger during active SOS setup.
   */
  async getCurrentLocation() {
    return {
      success: true,
      coords: {
        latitude: this.cachedLocation.latitude,
        longitude: this.cachedLocation.longitude,
        accuracy: this.cachedLocation.accuracy,
      },
      timestamp: new Date().toISOString(),
      source: 'Local GPS Provider (Demo Coordinates)',
    };
  }

  /**
   * Check if location services are available
   */
  async isLocationAvailable() {
    return {
      available: true,
      hasPermission: true,
      status: 'Active',
    };
  }
}

export const locationService = new LocationService();
export default locationService;
