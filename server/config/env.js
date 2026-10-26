/**
 * Central Environment Configuration Loader
 * Loads and validates environment variables for RescueLink backend.
 */
const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  jwt: {
    secret: process.env.JWT_SECRET || 'rescuelink_default_dev_secret_key_dont_use_in_prod',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};

module.exports = config;
