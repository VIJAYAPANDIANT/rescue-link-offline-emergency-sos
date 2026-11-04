/**
 * RescueLink Admin API Client
 *
 * Handles HTTP communication with the Express backend at /api/admin and /api/auth.
 * Automatically injects the JWT token from localStorage and intercepts 401s.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

class AdminApiClient {
  constructor() {
    this.tokenKey = 'rescuelink_admin_token';
    this.userKey = 'rescuelink_admin_user';
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setSession(token, user) {
    if (token) localStorage.setItem(this.tokenKey, token);
    if (user) localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  clearSession() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  getSavedUser() {
    const raw = localStorage.getItem(this.userKey);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        // Token expired or invalid
        this.clearSession();
        window.dispatchEvent(new CustomEvent('admin_auth_expired'));
      }

      if (!response.ok) {
        const error = new Error(data.error?.message || `Request failed with status ${response.status}`);
        error.code = data.error?.code || 'API_ERROR';
        error.status = response.status;
        error.details = data.error?.details || null;
        throw error;
      }

      return data;
    } catch (err) {
      if (!err.status) {
        err.code = 'NETWORK_ERROR';
        err.message = err.message || 'Unable to connect to the RescueLink backend server.';
      }
      throw err;
    }
  }

  // Auth Endpoints
  async login(email, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.user?.role !== 'admin') {
      throw new Error('Access denied. Administrator privileges are required to access this dashboard.');
    }

    this.setSession(res.token, res.user);
    return res;
  }

  async register(name, email, password, role = 'admin') {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });

    if (res.user?.role === 'admin' && res.token) {
      this.setSession(res.token, res.user);
    }
    return res;
  }

  async getProfile() {
    return this.request('/api/auth/me');
  }

  // Admin Endpoints
  async getDashboard() {
    return this.request('/api/admin/dashboard');
  }

  async getIncidents(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') {
        searchParams.append(k, v);
      }
    });
    const qs = searchParams.toString();
    return this.request(`/api/admin/incidents${qs ? `?${qs}` : ''}`);
  }

  async getIncidentById(id) {
    return this.request(`/api/admin/incidents/${id}`);
  }

  async updateIncidentStatus(id, { status, notes }) {
    return this.request(`/api/admin/incidents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  }

  async getUsers(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') {
        searchParams.append(k, v);
      }
    });
    const qs = searchParams.toString();
    return this.request(`/api/admin/users${qs ? `?${qs}` : ''}`);
  }

  async updateUserStatus(id, { status, role, notes }) {
    return this.request(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, role, notes }),
    });
  }

  async getRelayActivity(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v);
      }
    });
    const qs = searchParams.toString();
    return this.request(`/api/admin/relay${qs ? `?${qs}` : ''}`);
  }

  async getNotifications(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') {
        searchParams.append(k, v);
      }
    });
    const qs = searchParams.toString();
    return this.request(`/api/admin/notifications${qs ? `?${qs}` : ''}`);
  }

  async getAuditLogs(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') {
        searchParams.append(k, v);
      }
    });
    const qs = searchParams.toString();
    return this.request(`/api/admin/audit-logs${qs ? `?${qs}` : ''}`);
  }
}

export const adminApi = new AdminApiClient();
export default adminApi;
