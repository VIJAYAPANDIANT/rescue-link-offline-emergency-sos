/**
 * REST API Client for RescueLink Server
 * Communicates with the Node.js/Express backend for Health & Authentication.
 */

/**
 * Determine default backend REST URL based on runtime environment.
 * - Prioritizes EXPO_PUBLIC_API_URL environment variable if set.
 * - Uses 10.0.2.2:5000/api for Android (standard host loopback).
 * - Uses localhost:5000/api for iOS, Web, and desktop environments.
 */
export const resolveDefaultBaseUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  let os = 'unknown';
  try {
    // Dynamic resolution prevents syntax errors in pure Node test runtimes
    const RN = require('react-native');
    if (RN && RN.Platform) {
      os = RN.Platform.OS;
    }
  } catch (e) {
    os = 'node';
  }

  if (os === 'android') {
    return 'http://10.0.2.2:5000/api';
  }
  return 'http://localhost:5000/api';
};

const DEFAULT_API_BASE_URL = resolveDefaultBaseUrl();

class ApiClient {
  constructor(baseUrl = DEFAULT_API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = null;
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  setBaseUrl(url) {
    if (!url || typeof url !== 'string') return;
    let cleanUrl = url.trim().replace(/\/+$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    this.baseUrl = cleanUrl;
  }

  resetBaseUrl() {
    this.baseUrl = resolveDefaultBaseUrl();
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

  /**
   * Create an emergency alert
   * @param {object} alertPayload
   * @param {string} alertPayload.emergencyType
   * @param {string} [alertPayload.details]
   * @param {string} [alertPayload.contactDetails]
   * @param {object|null} [alertPayload.location]
   */
  async createAlert(alertPayload) {
    try {
      const response = await fetch(`${this.baseUrl}/alerts`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(alertPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Failed to create emergency alert.',
          code: data.error?.code,
          status: response.status,
        };
      }

      return {
        success: true,
        message: data.message,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error while creating alert.',
      };
    }
  }

  /**
   * Retrieve alerts belonging to the authenticated user
   * @param {object} [filter]
   * @param {string} [filter.status]
   */
  async getAlerts(filter = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filter.status) queryParams.append('status', filter.status);
      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const response = await fetch(`${this.baseUrl}/alerts${queryStr}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Failed to retrieve alerts.',
          code: data.error?.code,
          status: response.status,
        };
      }

      return {
        success: true,
        message: data.message,
        data: data.data || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error while retrieving alerts.',
      };
    }
  }

  /**
   * Retrieve a specific alert by ID
   * @param {string} alertId
   */
  async getAlertById(alertId) {
    try {
      const response = await fetch(`${this.baseUrl}/alerts/${alertId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || 'Failed to retrieve alert.',
          code: data.error?.code,
          status: response.status,
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error while fetching alert.',
      };
    }
  }

  /**
   * Update alert status (e.g. mark Resolved)
   * @param {string} alertId
   * @param {string} status
   */
  async updateAlertStatus(alertId, status) {
    try {
      const response = await fetch(`${this.baseUrl}/alerts/${alertId}/status`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Failed to update alert status.',
          code: data.error?.code,
          status: response.status,
        };
      }

      return {
        success: true,
        message: data.message,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error while updating alert status.',
      };
    }
  }

  /**
   * Synchronize a batch of offline emergency alerts with the backend.
   * @param {Array<object>} alertsList
   */
  async syncAlerts(alertsList) {
    try {
      const response = await fetch(`${this.baseUrl}/alerts/sync`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ alerts: alertsList }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Synchronization failed.',
          status: response.status,
          code: data.error?.code,
        };
      }

      return {
        success: true,
        message: data.message,
        results: data.results || [],
        summary: data.summary || { synced: 0, alreadySynced: 0, failed: 0, total: alertsList.length },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error during synchronization.',
      };
    }
  }

  /**
   * Fetch emergency contacts for the authenticated user.
   */
  async getContacts() {
    try {
      const response = await fetch(`${this.baseUrl}/contacts`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Failed to fetch emergency contacts.',
          status: response.status,
        };
      }

      return {
        success: true,
        count: data.count || (data.data ? data.data.length : 0),
        data: data.data || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error fetching contacts.',
      };
    }
  }

  /**
   * Create an emergency contact.
   */
  async createContact(contactData) {
    try {
      const response = await fetch(`${this.baseUrl}/contacts`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(contactData),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Failed to create emergency contact.',
          status: response.status,
          code: data.error?.code,
        };
      }

      return {
        success: true,
        message: data.message,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error creating contact.',
      };
    }
  }

  /**
   * Update an existing emergency contact.
   */
  async updateContact(contactId, updates) {
    try {
      const response = await fetch(`${this.baseUrl}/contacts/${contactId}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Failed to update contact.',
          status: response.status,
          code: data.error?.code,
        };
      }

      return {
        success: true,
        message: data.message,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error updating contact.',
      };
    }
  }

  /**
   * Delete an emergency contact.
   */
  async deleteContact(contactId) {
    try {
      const response = await fetch(`${this.baseUrl}/contacts/${contactId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Failed to delete contact.',
          status: response.status,
        };
      }

      return {
        success: true,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error deleting contact.',
      };
    }
  }

  /**
   * Fetch notification history.
   */
  async getNotifications({ alertId, channel, limit = 50, offset = 0 } = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (alertId) queryParams.append('alertId', alertId);
      if (channel) queryParams.append('channel', channel);
      if (limit) queryParams.append('limit', String(limit));
      if (offset) queryParams.append('offset', String(offset));

      const url = `${this.baseUrl}/notifications${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Failed to fetch notifications.',
          status: response.status,
        };
      }

      return {
        success: true,
        count: data.count || (data.data ? data.data.length : 0),
        data: data.data || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error fetching notifications.',
      };
    }
  }

  /**
   * Send test notification.
   */
  async testNotification({ channel, recipient }) {
    try {
      const response = await fetch(`${this.baseUrl}/notifications/test`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ channel, recipient }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Failed to send test notification.',
          status: response.status,
        };
      }

      return {
        success: true,
        message: data.message,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error sending test notification.',
      };
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;
