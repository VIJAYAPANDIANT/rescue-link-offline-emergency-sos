/**
 * RescueLink Emergency Notification Service
 *
 * Coordinates multi-channel emergency notification dispatch (Email, SMS)
 * to configured emergency contacts when an SOS is triggered.
 *
 * Enforces:
 * - Contact priority ordering
 * - Explicit location-sharing consent
 * - Strict credential isolation (no tokens/passwords in notifications)
 * - Idempotency & duplicate suppression
 * - Non-blocking dispatch (SOS creation never fails due to notification errors)
 */

const config = require('../../config/env');
const contactStore = require('../contactStore');
const notificationStore = require('../notificationStore');
const emailProvider = require('./providers/emailProvider');
const smsProvider = require('./providers/smsProvider');

class NotificationService {
  constructor() {
    this.emailProvider = emailProvider;
    this.smsProvider = smsProvider;
  }

  /**
   * Format clear emergency distress message.
   * Never includes JWT tokens, passwords, or database secrets.
   */
  formatNotificationMessage({ alert, senderName, locationConsent = true }) {
    const alertId = alert.id || alert.alertId || 'UNKNOWN';
    const type = alert.emergencyType || 'General Emergency';
    const sender = senderName || alert.senderName || 'A RescueLink User';
    const time = alert.createdAt ? new Date(alert.createdAt).toUTCString() : new Date().toUTCString();
    const details = alert.details ? alert.details.trim() : 'No additional incident description provided.';

    const subject = `🚨 EMERGENCY ALERT: ${sender} triggered ${type} SOS`;

    let locationSection = '';
    const hasCoords =
      alert.location &&
      typeof alert.location.latitude === 'number' &&
      typeof alert.location.longitude === 'number';

    if (hasCoords && locationConsent) {
      const { latitude, longitude } = alert.location;
      locationSection = `\n📍 GPS Location:\n• Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\n• View on Google Maps: https://maps.google.com/?q=${latitude},${longitude}\n`;
    } else {
      locationSection = '\n📍 Location: Omitted by sender or unavailable.\n';
    }

    const appUrl = config.notifications?.appBaseUrl || 'http://localhost:5000';
    const incidentUrl = `${appUrl}/api/alerts/${alertId}`;

    const body = `================================================
🚨 RESCUELINK EMERGENCY DISTRESS NOTIFICATION 🚨
================================================

This is an automated emergency distress message from RescueLink.
Your contact information was designated by ${sender} as an emergency point of contact.

INCIDENT SUMMARY:
• Distress Type: ${type}
• Responder / Survivor: ${sender}
• Timestamp: ${time}
• Incident Alert ID: ${alertId}
${locationSection}
DETAILS FROM SURVIVOR:
"${details}"

INCIDENT STATUS:
• Reference Endpoint: ${incidentUrl}

SAFETY NOTICE:
If you are able to reach local emergency services (911/112), please relay this distress report to official dispatchers immediately.

================================================
RescueLink Decentralized Emergency Response System
`;

    const smsBody = `🚨 RESCUELINK SOS: ${sender} triggered a ${type} alert at ${time}.${hasCoords && locationConsent ? ` Map: https://maps.google.com/?q=${alert.location.latitude},${alert.location.longitude}` : ''} ID: ${alertId.substring(0, 8)}`;

    return {
      subject,
      body,
      smsBody,
    };
  }

  /**
   * Dispatch SOS notifications to all enabled emergency contacts of the authenticated user.
   * Catches all errors internally so caller is never blocked.
   *
   * @param {object} user - Authenticated user initiating SOS
   * @param {object} alert - The emergency alert record
   * @param {object} [options]
   * @param {boolean} [options.locationConsent=true] - Whether user consented to attach location link
   * @returns {Promise<{ totalContacts: number, queuedCount: number, tasks: Array }>}
   */
  async dispatchSOSNotifications(user, alert, options = {}) {
    try {
      if (!user || !user.id || !alert) {
        return { totalContacts: 0, queuedCount: 0, tasks: [] };
      }

      const locationConsent = options.locationConsent !== false;
      const contacts = await contactStore.findEnabledByUserId(user.id);

      if (!contacts || contacts.length === 0) {
        return { totalContacts: 0, queuedCount: 0, tasks: [] };
      }

      const { subject, body, smsBody } = this.formatNotificationMessage({
        alert,
        senderName: user.name || alert.senderName,
        locationConsent,
      });

      const alertId = alert.id || alert.alertId;
      const dispatchedTasks = [];

      for (const contact of contacts) {
        // 1. Email Channel
        if (contact.email) {
          const idempotencyKey = `${alertId}:${contact.id}:email`;
          const existing = await notificationStore.findByIdempotencyKey(idempotencyKey);

          if (!existing) {
            const task = await notificationStore.createNotification({
              alertId,
              contactId: contact.id,
              contactName: contact.name,
              userId: user.id,
              channel: 'email',
              recipient: contact.email,
              status: 'queued',
              idempotencyKey,
              messageSubject: subject,
              messageBody: body,
            });

            // Dispatch immediately in background
            this.executeEmailDispatch(task, subject, body).catch((e) =>
              console.warn('[NotificationService] Email task error:', e.message)
            );

            dispatchedTasks.push(task);
          }
        }

        // 2. SMS Channel
        if (contact.phone) {
          const idempotencyKey = `${alertId}:${contact.id}:sms`;
          const existing = await notificationStore.findByIdempotencyKey(idempotencyKey);

          if (!existing) {
            const task = await notificationStore.createNotification({
              alertId,
              contactId: contact.id,
              contactName: contact.name,
              userId: user.id,
              channel: 'sms',
              recipient: contact.phone,
              status: 'queued',
              idempotencyKey,
              messageSubject: 'RescueLink SMS Alert',
              messageBody: smsBody,
            });

            // Dispatch immediately in background
            this.executeSMSDispatch(task, smsBody).catch((e) =>
              console.warn('[NotificationService] SMS task error:', e.message)
            );

            dispatchedTasks.push(task);
          }
        }
      }

      return {
        totalContacts: contacts.length,
        queuedCount: dispatchedTasks.length,
        tasks: dispatchedTasks,
      };
    } catch (err) {
      console.error('[NotificationService] Fatal dispatch error:', err.message);
      return { totalContacts: 0, queuedCount: 0, tasks: [], error: err.message };
    }
  }

  async executeEmailDispatch(task, subject, body) {
    try {
      await notificationStore.updateStatus(task.id, { status: 'sending' });

      const result = await this.emailProvider.sendEmail({
        to: task.recipient,
        subject,
        body,
      });

      if (result.success) {
        await notificationStore.updateStatus(task.id, {
          status: 'sent',
          provider: result.provider,
          providerMessageId: result.providerMessageId,
        });
      } else {
        await notificationStore.updateStatus(task.id, {
          status: 'failed',
          provider: result.provider,
          errorMessage: result.error || 'Email dispatch failed',
        });
      }
    } catch (err) {
      await notificationStore.updateStatus(task.id, {
        status: 'failed',
        errorMessage: err.message,
      });
    }
  }

  async executeSMSDispatch(task, body) {
    try {
      await notificationStore.updateStatus(task.id, { status: 'sending' });

      const result = await this.smsProvider.sendSMS({
        to: task.recipient,
        body,
      });

      if (result.success) {
        await notificationStore.updateStatus(task.id, {
          status: 'sent',
          provider: result.provider,
          providerMessageId: result.providerMessageId,
        });
      } else {
        await notificationStore.updateStatus(task.id, {
          status: 'failed',
          provider: result.provider,
          errorMessage: result.error || 'SMS dispatch failed',
        });
      }
    } catch (err) {
      await notificationStore.updateStatus(task.id, {
        status: 'failed',
        errorMessage: err.message,
      });
    }
  }

  /**
   * Test notification dispatch for developers / administrators.
   */
  async testNotification(user, { channel, recipient }) {
    if (!channel || !['email', 'sms'].includes(channel)) {
      throw new Error('channel must be either "email" or "sms".');
    }

    if (!recipient || typeof recipient !== 'string') {
      throw new Error('recipient is required.');
    }

    const testAlert = {
      id: `test-sos-${Date.now()}`,
      emergencyType: 'Test / Drill',
      details: 'This is a test notification confirming your RescueLink notification gateway.',
      createdAt: new Date().toISOString(),
      location: { latitude: 13.0827, longitude: 80.2707 },
    };

    const { subject, body, smsBody } = this.formatNotificationMessage({
      alert: testAlert,
      senderName: user.name || 'Test User',
      locationConsent: true,
    });

    if (channel === 'email') {
      const res = await this.emailProvider.sendEmail({
        to: recipient,
        subject,
        body,
      });
      return res;
    } else {
      const res = await this.smsProvider.sendSMS({
        to: recipient,
        body: smsBody,
      });
      return res;
    }
  }
}

const notificationService = new NotificationService();
module.exports = notificationService;
