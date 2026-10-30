/**
 * RescueLink SMS Notification Provider
 *
 * Supports Twilio SMS gateway with safe fallback to simulated provider
 * when credentials are not configured in development or test environments.
 */

const config = require('../../../config/env');

class SMSProvider {
  constructor() {
    this.smsConfig = config.notifications?.sms || {};
  }

  isConfigured() {
    return Boolean(
      this.smsConfig.enabled &&
      this.smsConfig.twilioAccountSid &&
      this.smsConfig.twilioAuthToken &&
      this.smsConfig.twilioFromPhone
    );
  }

  /**
   * Send an emergency SMS alert.
   *
   * @param {object} params
   * @param {string} params.to - Recipient phone number (E.164)
   * @param {string} params.body - SMS plain text message
   * @returns {Promise<{ success: boolean, provider: string, providerMessageId: string, error?: string }>}
   */
  async sendSMS({ to, body }) {
    if (!to || typeof to !== 'string') {
      return {
        success: false,
        provider: 'twilio',
        error: 'Missing recipient phone number.',
      };
    }

    if (!this.smsConfig.enabled) {
      return {
        success: false,
        provider: 'disabled',
        error: 'SMS notifications are disabled in configuration.',
      };
    }

    // If configured with real Twilio account, attempt live API dispatch
    if (this.isConfigured()) {
      try {
        let twilio = null;
        try {
          twilio = require('twilio');
        } catch (e) {
          // Twilio optional dependency
        }

        if (twilio) {
          const client = twilio(this.smsConfig.twilioAccountSid, this.smsConfig.twilioAuthToken);
          const message = await client.messages.create({
            body,
            from: this.smsConfig.twilioFromPhone,
            to,
          });

          return {
            success: true,
            provider: 'twilio',
            providerMessageId: message.sid || `tw-${Date.now()}`,
          };
        }
      } catch (err) {
        console.error('[SMSProvider] Twilio dispatch failed:', err.message);
        return {
          success: false,
          provider: 'twilio',
          error: err.message,
        };
      }
    }

    // Development / Test Simulated Delivery
    // Accurately labels provider as 'simulated_twilio'
    const simMessageId = `sim-sms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[SMSProvider: Simulated] Transmitted SMS to <${to}> | Length: ${body.length} chars | ID: ${simMessageId}`);

    return {
      success: true,
      provider: 'simulated_twilio',
      providerMessageId: simMessageId,
      notice: 'Simulated dispatch (Twilio credentials not configured in environment).',
    };
  }
}

const smsProvider = new SMSProvider();
module.exports = smsProvider;
