'use strict';

/**
 * Central configuration, sourced from environment variables with safe defaults.
 * Keeping this in one place makes the app 12-factor friendly and easy to configure
 * differently per environment (test / staging / production) in the CI/CD pipeline.
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  // API key required by the auth middleware for write operations.
  // Overridden per-environment in docker-compose / Jenkins credentials.
  apiKey: process.env.API_KEY || 'local-dev-key',
  // Application version is stamped at build time (see Dockerfile ARG APP_VERSION).
  version: process.env.APP_VERSION || require('../package.json').version,
  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
