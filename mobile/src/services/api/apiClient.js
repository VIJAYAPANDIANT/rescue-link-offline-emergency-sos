/**
 * REST API Client for RescueLink Server
 * Communicates with the Node.js/Express backend for Health & Authentication.
 */

// Default local backend URL (Use 10.0.2.2 for Android Emulator, localhost for iOS/Web)
const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';

class ApiClient {
  constructor(baseUrl = DEFAULT_API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  setBaseUrl(url) {
    this.baseUrl = url;
  }

  setToken(token) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  clearToken() {
    this.token = null;
  }

  /**
   * Helper to construct request headers with optional Bearer token
   */
  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Check Backend Server Health
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
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

  /**
   * Register a new user
   * @param {object} params
   * @param {string} params.name
   * @param {string} params.email
   * @param {string} params.password
   */
  async register({ name, email, password }) {
    try {
      const response = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || 'Registration failed.',
          code: data.error?.code,
        };
      }

      if (data.token) {
        this.setToken(data.token);
      }

      return {
        success: true,
        user: data.user,
        token: data.token,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error while attempting registration.',
      };
    }
  }

  /**
   * Authenticate existing user
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.password
   */
  async login({ email, password }) {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || 'Invalid email or password.',
          code: data.error?.code,
        };
      }

      if (data.token) {
        this.setToken(data.token);
      }

      return {
        success: true,
        user: data.user,
        token: data.token,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error while attempting login.',
      };
    }
  }

  /**
   * Fetch authenticated user profile
   * @param {string} [tokenOverride]
   */
  async getProfile(tokenOverride) {
    try {
      const effectiveToken = tokenOverride || this.token;
      if (!effectiveToken) {
        return {
          success: false,
          error: 'No active session token.',
          code: 'NO_TOKEN',
        };
      }

      const response = await fetch(`${this.baseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || 'Failed to fetch user profile.',
          code: data.error?.code,
        };
      }

      return {
        success: true,
        user: data.user,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error while fetching profile.',
      };
    }
  }

  /**
   * Log out and clear session token
   */
  logout() {
    this.clearToken();
    return { success: true };
  }
}

export const apiClient = new ApiClient();
export default apiClient;
