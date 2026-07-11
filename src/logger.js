'use strict';

const config = require('./config');

/**
 * Minimal structured (JSON) logger. Emitting JSON lines to stdout means the logs
 * are machine-parseable and can be scraped/aggregated by monitoring tooling
 * (e.g. Loki/Datadog) in a real deployment without extra dependencies.
 */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = LEVELS[config.logLevel] ?? LEVELS.info;

function log(level, message, meta = {}) {
  if (LEVELS[level] > activeLevel) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

module.exports = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};
