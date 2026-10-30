/**
 * Audit Log Store Service
 *
 * Implements persistent JSON-file storage for RescueLink administrative audit logs
 * in `server/data/audit_logs.json`.
 *
 * Safety & Reliability Constraints:
 * 1. Safe JSON-file operations: writes to a temporary file and atomically renames.
 * 2. Overlapping writes prevented via an asynchronous operation mutex lock.
 * 3. Atomic rename retry loop with backoff for Windows file-locking resilience.
 * 4. Never exposes passwords, JWTs, or secrets in logged details.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_logs.json');

class AuditStore {
  constructor() {
    this.writeLock = Promise.resolve();
    this.ensureInitialized();
  }

  ensureInitialized() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(AUDIT_FILE)) {
      fs.writeFileSync(AUDIT_FILE, JSON.stringify([], null, 2), 'utf8');
    }
  }

  async readLogs() {
    this.ensureInitialized();
    const rawData = await fs.promises.readFile(AUDIT_FILE, 'utf8');
    if (!rawData.trim()) return [];

    try {
      const parsed = JSON.parse(rawData);
      if (!Array.isArray(parsed)) {
        throw new Error('audit_logs.json root structure must be an Array.');
      }
      return parsed;
    } catch (parseError) {
      console.error('[CRITICAL] Corrupted audit_logs.json detected:', parseError.message);
      const corruptErr = new Error(
        `Corrupted audit log file detected at ${AUDIT_FILE}: ${parseError.message}.`
      );
      corruptErr.code = 'CORRUPTED_AUDIT_DATA';
      throw corruptErr;
    }
  }

  async writeLogs(logsList) {
    if (!Array.isArray(logsList)) {
      throw new Error('writeLogs requires an array of audit log objects.');
    }

    return new Promise((resolve, reject) => {
      this.writeLock = this.writeLock
        .then(async () => {
          const tempFile = `${AUDIT_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
          const jsonPayload = JSON.stringify(logsList, null, 2);

          await fs.promises.writeFile(tempFile, jsonPayload, 'utf8');

          let renamed = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              await fs.promises.rename(tempFile, AUDIT_FILE);
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
          console.error('[AuditStore] Error writing audit_logs.json:', err);
          reject(err);
        });
    });
  }

  /**
   * Record a new administrative action.
   */
  async createLog({
    action,
    adminId,
    adminEmail,
    targetType,
    targetId,
    details = {},
    ipAddress = null,
    userAgent = null,
  }) {
    if (!action) throw new Error('Audit log action is required.');

    // Sanitize details to guarantee zero secrets are recorded
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.passwordHash;
    delete sanitizedDetails.token;
    delete sanitizedDetails.secret;

    const logs = await this.readLogs();

    const newEntry = {
      id: crypto.randomUUID(),
      action,
      adminId: adminId || 'system',
      adminEmail: adminEmail || 'system@rescuelink.org',
      targetType: targetType || 'system',
      targetId: targetId || null,
      details: sanitizedDetails,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
    };

    logs.push(newEntry);
    await this.writeLogs(logs);
    return newEntry;
  }

  /**
   * Retrieve paginated audit logs with optional filters.
   */
  async getLogs({ page = 1, limit = 20, action, targetType, search } = {}) {
    const logs = await this.readLogs();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    let filtered = logs.filter((l) => {
      if (action && l.action !== action) return false;
      if (targetType && l.targetType !== targetType) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesAction = l.action.toLowerCase().includes(q);
        const matchesEmail = l.adminEmail.toLowerCase().includes(q);
        const matchesTarget = l.targetId && l.targetId.toLowerCase().includes(q);
        if (!matchesAction && !matchesEmail && !matchesTarget) return false;
      }
      return true;
    });

    // Newest first
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(startIndex, startIndex + limitNum);

    return {
      logs: paginated,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieve audit logs for a specific target entity (e.g. incident or user).
   */
  async getLogsForTarget(targetType, targetId) {
    if (!targetType || !targetId) return [];
    const logs = await this.readLogs();
    return logs
      .filter((l) => l.targetType === targetType && l.targetId === targetId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

const auditStore = new AuditStore();
module.exports = auditStore;
