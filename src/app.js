'use strict';

const express = require('express');
const { register, metricsMiddleware } = require('./metrics');
const logger = require('./logger');
const healthRoutes = require('./routes/health');
const taskRoutes = require('./routes/tasks');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

/**
 * Builds and returns the Express application.
 * Exposing a factory (rather than a started server) lets the test suite mount
 * the app with supertest without binding a port, which is faster and avoids
 * port clashes in CI.
 */
function createApp() {
  const app = express();

  app.use(express.json());
  app.use(metricsMiddleware);

  // Lightweight request log line for observability.
  app.use((req, res, next) => {
    res.on('finish', () => {
      logger.info('request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
      });
    });
    next();
  });

  // Operational endpoints
  app.use('/', healthRoutes);
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // Business endpoints
  app.use('/api/tasks', taskRoutes);

  // Fallbacks
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
