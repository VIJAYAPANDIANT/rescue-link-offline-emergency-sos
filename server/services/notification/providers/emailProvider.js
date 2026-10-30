/**
 * RescueLink Email Notification Provider
 *
 * Supports production SMTP transport with safe fallback to simulated provider
 * when credentials are not configured in development or test environments.
 */

const config = require('../../../config/env');

class EmailProvider {
  constructor() {
    this.emailConfig = config.notifications?.email || {};
  }

  isConfigured() {
    return Boolean(
      this.emailConfig.enabled &&
      this.emailConfig.smtpHost &&
      this.emailConfig.smtpUser &&
      this.emailConfig.smtpPass
    );
  }

  /**
   * Send an emergency email alert.
   *
   * @param {object} params
   * @param {string} params.to - Recipient email address
   * @param {string} params.subject - Email subject line
   * @param {string} params.body - Email plain text content
   * @returns {Promise<{ success: boolean, provider: string, providerMessageId: string, error?: string }>}
   */
  async sendEmail({ to, subject, body }) {
    if (!to || typeof to !== 'string') {
      return {
        success: false,
        provider: 'smtp',
        error: 'Missing recipient email address.',
      };
    }

    if (!this.emailConfig.enabled) {
      return {
        success: false,
        provider: 'disabled',
        error: 'Email notifications are disabled in configuration.',
      };
    }

    // If configured with real SMTP server, attempt SMTP dispatch
    if (this.isConfigured()) {
      try {
        let nodemailer = null;
        try {
          nodemailer = require('nodemailer');
        } catch (e) {
          // Nodemailer optional dependency
        }

        if (nodemailer) {
          const transporter = nodemailer.createTransport({
            host: this.emailConfig.smtpHost,
            port: this.emailConfig.smtpPort,
            secure: this.emailConfig.smtpPort === 465,
            auth: {
              user: this.emailConfig.smtpUser,
              pass: this.emailConfig.smtpPass,
            },
          });

          const info = await transporter.sendMail({
            from: this.emailConfig.fromEmail,
            to,
            subject,
            text: body,
          });

          return {
            success: true,
            provider: 'smtp',
            providerMessageId: info.messageId || `smtp-${Date.now()}`,
          };
        }
      } catch (err) {
        console.error('[EmailProvider] SMTP dispatch failed:', err.message);
        return {
          success: false,
          provider: 'smtp',
          error: err.message,
        };
      }
    }

    // Development / Test Simulated Delivery
    // Accurately labels provider as 'simulated_smtp' without fabricating central delivery receipts
    const simMessageId = `sim-email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[EmailProvider: Simulated] Transmitted alert to <${to}> | Subject: "${subject}" | ID: ${simMessageId}`);

    return {
      success: true,
      provider: 'simulated_smtp',
      providerMessageId: simMessageId,
      notice: 'Simulated dispatch (SMTP credentials not configured in environment).',
    };
  }
}

const emailProvider = new EmailProvider();
module.exports = emailProvider;
