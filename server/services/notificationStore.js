/**
 * RescueLink Notification Task Data Store
 *
 * Implements atomic, file-locked persistence for emergency notifications.
 * Tracks task statuses, provider responses, delivery timestamps, and idempotency.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NOTIFICATIONS_FILE = path.join(__dirname, '..', 'data', 'notifications.json');

class NotificationStore {
  constructor() {
    this.writeQueue = Promise.resolve();
    this.ensureFileExists();
  }

  ensureFileExists() {
    try {
      const dir = path.dirname(NOTIFICATIONS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(NOTIFICATIONS_FILE)) {
        fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify([], null, 2), 'utf8');
      }
    } catch (err) {
      console.error('[NotificationStore] Error initializing notifications.json:', err.message);
    }
  }

  async readNotifications() {
    try {
      const raw = await fs.promises.readFile(NOTIFICATIONS_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      console.error('[NotificationStore] Error reading notifications.json:', err.message);
      return [];
    }
  }

  writeNotifications(notificationsList) {
    return new Promise((resolve, reject) => {
      this.writeQueue = this.writeQueue
        .then(async () => {
          const tempFile = `${NOTIFICATIONS_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
          const jsonPayload = JSON.stringify(notificationsList, null, 2);
          await fs.promises.writeFile(tempFile, jsonPayload, 'utf8');

          let renamed = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              await fs.promises.rename(tempFile, NOTIFICATIONS_FILE);
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
          console.error('[NotificationStore] Error writing notifications.json:', err.message);
          reject(err);
        });
    });
  }

  /**
   * Find notification by unique idempotency key.
   */
  async findByIdempotencyKey(key) {
    if (!key) return null;
    const notifications = await this.readNotifications();
    return notifications.find((n) => n.idempotencyKey === key) || null;
  }

  /**
   * Find all notifications for a specific user.
   */
  async findByUserId(userId, { alertId, channel, limit = 50, offset = 0 } = {}) {
    if (!userId) return [];
    const notifications = await this.readNotifications();

    return notifications
      .filter((n) => {
        if (n.userId !== userId) return false;
        if (alertId && n.alertId !== alertId) return false;
        if (channel && n.channel !== channel) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(offset, offset + limit);
  }

  /**
   * Find notification by ID.
   */
  async findById(id, userId) {
    if (!id) return null;
    const notifications = await this.readNotifications();
    const item = notifications.find((n) => n.id === id);
    if (!item) return null;
    if (userId && item.userId !== userId) return null;
    return item;
  }

  /**
   * Create a new notification task record.
   */
  async createNotification(taskData) {
    const notifications = await this.readNotifications();
    const nowIso = new Date().toISOString();

    const newNotification = {
      id: crypto.randomUUID(),
      alertId: taskData.alertId,
      contactId: taskData.contactId || null,
      contactName: taskData.contactName || 'Emergency Contact',
      userId: taskData.userId,
      channel: taskData.channel, // 'email' | 'sms' | 'push'
      recipient: taskData.recipient, // email address or phone number
      status: taskData.status || 'queued', // 'queued' | 'sending' | 'sent' | 'delivered' | 'failed'
      idempotencyKey: taskData.idempotencyKey || null,
      messageSubject: taskData.messageSubject || null,
      messageBody: taskData.messageBody || '',
      provider: taskData.provider || 'simulated',
      providerMessageId: taskData.providerMessageId || null,
      retryCount: typeof taskData.retryCount === 'number' ? taskData.retryCount : 0,
      errorMessage: taskData.errorMessage || null,
      sentAt: taskData.status === 'sent' || taskData.status === 'delivered' ? nowIso : null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    notifications.push(newNotification);
    await this.writeNotifications(notifications);
    return newNotification;
  }

  /**
   * Update delivery status and provider confirmation.
   */
  async updateStatus(id, { status, provider, providerMessageId, errorMessage }) {
    const notifications = await this.readNotifications();
    const index = notifications.findIndex((n) => n.id === id);

    if (index === -1) {
      return null;
    }

    const existing = notifications[index];
    const nowIso = new Date().toISOString();

    const updated = {
      ...existing,
      status: status || existing.status,
      provider: provider || existing.provider,
      providerMessageId: providerMessageId !== undefined ? providerMessageId : existing.providerMessageId,
      errorMessage: errorMessage !== undefined ? errorMessage : existing.errorMessage,
      sentAt: (status === 'sent' || status === 'delivered') && !existing.sentAt ? nowIso : existing.sentAt,
      updatedAt: nowIso,
    };

    if (status === 'failed') {
      updated.retryCount = (existing.retryCount || 0) + 1;
    }

    notifications[index] = updated;
    await this.writeNotifications(notifications);
    return updated;
  }

  /**
   * Helper to mask sensitive recipient details for privacy-preserving monitoring.
   */
  maskRecipient(recipient, channel) {
    if (!recipient || typeof recipient !== 'string') return '***';
    const trimmed = recipient.trim();
    if (channel === 'email' || trimmed.includes('@')) {
      const parts = trimmed.split('@');
      if (parts.length !== 2) return '***@***';
      const user = parts[0];
      const domain = parts[1];
      if (user.length <= 2) {
        return `${user[0] || '*'}***@${domain}`;
      }
      return `${user[0]}***${user[user.length - 1]}@${domain}`;
    }
    // Phone number masking: keep country code and last 2-4 digits
    if (trimmed.length > 5) {
      const last = trimmed.slice(-4);
      const prefix = trimmed.startsWith('+') ? trimmed.slice(0, 3) : trimmed.slice(0, 2);
      return `${prefix}***${last}`;
    }
    return '***';
  }

  /**
   * Retrieve paginated notifications with optional channel and status filters.
   * Recipient details are securely masked for administrative monitoring.
   */
  async getPaginatedNotifications({ page = 1, limit = 20, channel, status, alertId } = {}) {
    const notifications = await this.readNotifications();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    let filtered = notifications.filter((n) => {
      if (channel && channel !== 'all' && n.channel !== channel) return false;
      if (status && status !== 'all' && n.status !== status) return false;
      if (alertId && n.alertId !== alertId) return false;
      return true;
    });

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = filtered.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(startIndex, startIndex + limitNum).map((n) => ({
      ...n,
      recipient: this.maskRecipient(n.recipient, n.channel),
      rawRecipientLength: n.recipient ? n.recipient.length : 0,
    }));

    return {
      notifications: paginated,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get delivery statistics across all notification tasks.
   */
  async getNotificationStats() {
    const notifications = await this.readNotifications();
    const stats = {
      total: notifications.length,
      queued: 0,
      sending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      byChannel: {
        email: 0,
        sms: 0,
        push: 0,
      },
    };

    for (const n of notifications) {
      if (stats[n.status] !== undefined) {
        stats[n.status]++;
      }
      if (stats.byChannel[n.channel] !== undefined) {
        stats.byChannel[n.channel]++;
      }
    }

    return stats;
  }
}

const notificationStore = new NotificationStore();
module.exports = notificationStore;
