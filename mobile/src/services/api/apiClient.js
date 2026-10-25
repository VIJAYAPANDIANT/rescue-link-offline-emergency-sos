/**
 * REST API Client for RescueLink Server
 * Communicates with the Node.js/Express backend when network connectivity is present.
 */

// Default local backend URL (Use 10.0.2.2 for Android Emulator, localhost for iOS/Web)
const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';

class ApiClient {
  constructor(baseUrl = DEFAULT_API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url) {
    this.baseUrl = url;
  }

  /**
   * Check Backend Server Health
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unable to connect to RescueLink server',
      };
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;
