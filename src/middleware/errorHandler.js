'use strict';

const logger = require('../logger');

/**
 * Centralised error handler. Maps known error shapes to HTTP responses:
 *  - zod ValidationError  -> 400 with field details
 *  - NotFoundError        -> 404
 *  - everything else      -> 500 (logged, generic message to the client)
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // zod validation error
  if (err && err.name === 'ZodError') {
    return res.status(400).json({
      error: 'ValidationError',
      details: err.issues.map((i) => ({
        field: i.path.join('.') || '(root)',
        message: i.message,
      })),
    });
  }

  if (err && err.status === 404) {
    return res.status(404).json({ error: 'NotFound', message: err.message });
  }

  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  return res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred.',
  });
}

/** 404 handler for unmatched routes. */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.path} does not exist.`,
  });
}

module.exports = { errorHandler, notFoundHandler };
