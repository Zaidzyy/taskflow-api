'use strict';

const express = require('express');
const config = require('../config');

const router = express.Router();

const startedAt = Date.now();

/**
 * Liveness/readiness probe. Returns 200 with basic runtime info.
 * Used by docker-compose healthchecks and by the Jenkins Deploy stage
 * to confirm the container is actually serving traffic before proceeding.
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: config.version,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
