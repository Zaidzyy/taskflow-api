'use strict';

const config = require('../config');

/**
 * Simple API-key authentication for state-changing requests.
 * Clients must send `X-API-Key: <key>`. Read-only endpoints (GET) are public,
 * while POST/PUT/DELETE require the key. In a real system this would be a JWT
 * or OAuth layer; an API key is enough to demonstrate authz in the pipeline.
 */
function requireApiKey(req, res, next) {
  const provided = req.get('X-API-Key');
  if (!provided || provided !== config.apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'A valid X-API-Key header is required for this operation.',
    });
  }
  return next();
}

module.exports = { requireApiKey };
