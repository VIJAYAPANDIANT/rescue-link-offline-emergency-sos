/**
 * Alert File Store Service
 *
 * Implements persistent JSON-file storage for emergency alerts in `server/data/alerts.json`.
 *
 * Architectural Note on JSON Storage:
 * JSON-file storage is lightweight, dependency-free, and suitable for local prototyping and initial assignments.
 * However, in high-throughput production workloads or multi-instance/serverless clusters, file-based storage has
 * severe concurrency limitations and lack of ACID transactions. In Step 4+, cloud records will migrate to MongoDB,
 * and offline mobile records will reside in local SQLite.
 *
 * Safety & Reliability Constraints:
 * 1. Safe JSON-file operations: writes to a temporary file and atomically renames.
 * 2. Overlapping writes prevented via an asynchronous operation mutex lock.
 * 3. Never silently overwrites corrupted files; explicit SyntaxError thrown.
 * 4. Preserves all other users' records when updating an individual alert.
 * 5. Strictly excludes passwords, password hashes, and auth tokens from alert records.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');

class AlertStore extends EventEmitter {
  constructor() {
    super();
    this.writeLock = Promise.resolve();
    this.ensureInitialized();
  }

  /**
   * Ensure data directory and alerts.json file exist.
   * Initializes with empty array `[]` only if the file does not exist.
   */
  ensureInitialized() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(ALERTS_FILE)) {
      fs.writeFileSync(ALERTS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }

  /**
   * Read and parse alerts.json safely.
   * If the file is corrupted (SyntaxError), throws an explicit error rather than wiping it.
   */
  async readAlerts() {
    this.ensureInitialized();

    const rawData = await fs.promises.readFile(ALERTS_FILE, 'utf8');

    // Handle empty file edge-case
    if (!rawData.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawData);
      if (!Array.isArray(parsed)) {
        throw new Error('alerts.json root structure must be an Array.');
      }
      return parsed;
    } catch (parseError) {
      console.error('[CRITICAL] Corrupted alerts.json detected:', parseError.message);
      const corruptErr = new Error(
        `Corrupted alert data file detected at ${ALERTS_FILE}: ${parseError.message}. Data will not be overwritten.`
      );
      corruptErr.code = 'CORRUPTED_ALERT_DATA';
      throw corruptErr;
    }
  }

  /**
   * Atomic write to alerts.json using a temp file.
   * Serialized through a promise-based write lock to prevent race conditions.
   */
  async writeAlerts(alertsList) {
    if (!Array.isArray(alertsList)) {
      throw new Error('writeAlerts requires an array of alert objects.');
    }

    // Execute within serialized write queue
    return new Promise((resolve, reject) => {
      this.writeLock = this.writeLock
        .then(async () => {
          const tempFile = `${ALERTS_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
          const jsonPayload = JSON.stringify(alertsList, null, 2);

          // Write payload to temporary file first
          await fs.promises.writeFile(tempFile, jsonPayload, 'utf8');

          // Atomically rename temp file over destination file with retry
          let renamed = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              await fs.promises.rename(tempFile, ALERTS_FILE);
              renamed = true;
              break;
            } catch (err) {
              if ((err.code === 'EPERM' || err.code === 'EBUSY') && attempt < 4) {
                await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
              } else {
                try { await fs.promises.unlink(tempFile); } catch (e) {}
                throw err;
              }
            }
          }

          if (renamed) resolve();
        })
        .catch((err) => {
          console.error('[AlertStore] Error writing alerts.json:', err);
          reject(err);
        });
    });
  }

  /**
   * Find an alert by its unique alert ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    if (!id) return null;
    const alerts = await this.readAlerts();
    return alerts.find((a) => a.id === id) || null;
  }

  /**
   * Retrieve alerts belonging to a specific sender, sorted newest first.
   * @param {string} senderId
   * @param {string} [statusFilter] Optional status filter
   * @returns {Promise<Array>}
   */
  async findBySenderId(senderId, statusFilter) {
    if (!senderId) return [];
    const alerts = await this.readAlerts();

    return alerts
      .filter((a) => {
        if (a.senderId !== senderId) return false;
        if (statusFilter && a.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Create and persist a new emergency alert.
   *
   * @param {object} alertData
   * @returns {Promise<object>} Created alert record
   */
  async createAlert(alertData) {
    const alerts = await this.readAlerts();

    const newAlert = {
      id: crypto.randomUUID(),
      senderId: alertData.senderId,
      senderName: alertData.senderName,
      emergencyType: alertData.emergencyType,
      details: alertData.details || '',
      contactDetails: alertData.contactDetails || '',
      location: alertData.location || null,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    alerts.push(newAlert);
    await this.writeAlerts(alerts);
    this.emit('alert_event', { type: 'alert_created', alert: newAlert });
    return newAlert;
  }

  /**
   * Idempotently synchronize an alert using a stable client-generated alert ID.
   * If an alert with the same ID already exists, returns existing without duplication.
   *
   * @param {object} alertData
   * @returns {Promise<{ alert: object, isNew: boolean }>}
   */
  async syncAlert(alertData) {
    const alerts = await this.readAlerts();
    const existing = alerts.find((a) => a.id === alertData.id);

    if (existing) {
      return { alert: existing, isNew: false };
    }

    const newAlert = {
      id: alertData.id,
      senderId: alertData.senderId || null,
      senderName: alertData.senderName || 'Anonymous Responder',
      emergencyType: alertData.emergencyType,
      details: alertData.details || '',
      contactDetails: alertData.contactDetails || '',
      location: alertData.location || null,
      source: alertData.source || 'local',
      relayedBy: alertData.relayedBy || null,
      relayedByName: alertData.relayedByName || null,
      hopCount: typeof alertData.hopCount === 'number' ? alertData.hopCount : 0,
      forwarderId: alertData.forwarderId || null,
      originalSenderId: alertData.originalSenderId || null,
      status: alertData.status || 'Pending',
      createdAt: alertData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    alerts.push(newAlert);
    await this.writeAlerts(alerts);
    this.emit('alert_event', { type: 'alert_synced', alert: newAlert });
    return { alert: newAlert, isNew: true };
  }

  /**
   * Update the status of an existing alert.
   *
   * @param {string} id
   * @param {string} newStatus
   * @returns {Promise<object|null>} Updated alert record or null if not found
   */
  async updateStatus(id, newStatus) {
    const alerts = await this.readAlerts();
    const index = alerts.findIndex((a) => a.id === id);

    if (index === -1) {
      return null;
    }

    alerts[index] = {
      ...alerts[index],
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    await this.writeAlerts(alerts);
    this.emit('alert_event', { type: 'alert_updated', alert: alerts[index] });
    return alerts[index];
  }

  /**
   * Retrieve all alerts with optional geographic, category, and timestamp filters.
   *
   * @param {object} [options]
   * @param {string} [options.status]
   * @param {string} [options.emergencyType]
   * @param {string} [options.since]
   * @param {boolean} [options.hasLocation]
   * @returns {Promise<Array>}
   */
  async getAllAlerts({ status, emergencyType, since, hasLocation } = {}) {
    const alerts = await this.readAlerts();
    return alerts
      .filter((a) => {
        if (status && status !== 'all' && status !== 'ALL' && a.status !== status) return false;
        if (emergencyType && a.emergencyType !== emergencyType) return false;
        if (since && new Date(a.updatedAt || a.createdAt) <= new Date(since)) return false;
        if (hasLocation === true) {
          if (!a.location || typeof a.location.latitude !== 'number' || typeof a.location.longitude !== 'number') {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

const alertStore = new AlertStore();
module.exports = alertStore;
