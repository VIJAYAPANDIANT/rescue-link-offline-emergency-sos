/**
 * Central Environment Configuration Loader
 * Loads and validates environment variables for RescueLink backend.
 */
const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = config;
