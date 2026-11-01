/**
 * Central Environment Configuration Loader
 * Loads and validates environment variables for RescueLink backend.
 */
const dotenv = require('dotenv');

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const defaultDevSecret = 'rescuelink_default_dev_secret_key_dont_use_in_prod';

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  jwt: {
    secret: process.env.JWT_SECRET || defaultDevSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  notifications: {
    email: {
      enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'false',
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || '',
      fromEmail: process.env.SMTP_FROM || 'emergency@rescuelink.org',
    },
    sms: {
      enabled: process.env.SMS_NOTIFICATIONS_ENABLED !== 'false',
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
      twilioFromPhone: process.env.TWILIO_FROM_PHONE || '',
    },
    push: {
      enabled: process.env.PUSH_NOTIFICATIONS_ENABLED !== 'false',
      expoPushEndpoint: process.env.EXPO_PUSH_ENDPOINT || 'https://exp.host/--/api/v2/push/send',
    },
    appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5000',
  },

  /**
   * Validates runtime environment configuration and warns of production misconfigurations.
   */
  validateEnvironment() {
    const warnings = [];
    const fatalErrors = [];

    if (this.isProduction) {
      if (this.jwt.secret === defaultDevSecret || this.jwt.secret.length < 32) {
        fatalErrors.push(
          'CRITICAL SECURITY ERROR: In production mode, JWT_SECRET must be set to a secure, non-default string of at least 32 characters (e.g. generate via `openssl rand -hex 32`).'
        );
      }
    } else if (this.jwt.secret === defaultDevSecret) {
      warnings.push(
        'SECURITY NOTICE: JWT_SECRET is using the insecure default development key. Set a unique secret before deploying.'
      );
    }

    if (isNaN(this.port) || this.port < 1 || this.port > 65535) {
      warnings.push(`Invalid PORT configuration (${this.port}). Defaulting to 5000.`);
      this.port = 5000;
    }

    if (warnings.length > 0) {
      console.warn('====================================================');
      console.warn(' [ENVIRONMENT CONFIGURATION AUDIT WARNINGS]');
      warnings.forEach((w) => console.warn(` - ${w}`));
      console.warn('====================================================');
    }

    if (fatalErrors.length > 0) {
      console.error('====================================================');
      console.error(' [FATAL PRODUCTION CONFIGURATION AUDIT ERRORS]');
      fatalErrors.forEach((err) => console.error(` - ${err}`));
      console.error('====================================================');
      throw new Error(fatalErrors.join(' '));
    }

    return {
      valid: warnings.length === 0 && fatalErrors.length === 0,
      warnings,
    };
  },
};

module.exports = config;
