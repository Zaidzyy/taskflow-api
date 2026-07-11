'use strict';

const createApp = require('./app');
const config = require('./config');
const logger = require('./logger');

/**
 * Process entry point. Starts the HTTP server and wires up graceful shutdown
 * so the container stops cleanly (important for zero-downtime deploys/rollbacks).
 */
const app = createApp();

const server = app.listen(config.port, () => {
  logger.info('TaskFlow API started', {
    port: config.port,
    env: config.env,
    version: config.version,
  });
});

function shutdown(signal) {
  logger.info('Shutting down', { signal });
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force-exit if connections do not drain in time.
  setTimeout(() => process.exit(1), 10000).unref();
}

['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => shutdown(sig)));

module.exports = server;
