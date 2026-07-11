'use strict';

const client = require('prom-client');

/**
 * Prometheus metrics setup. We expose:
 *  - default Node.js process metrics (CPU, memory, event loop lag, GC)
 *  - a custom HTTP request counter labelled by method/route/status
 *  - a custom request-duration histogram (for latency alerting / SLOs)
 *  - a gauge tracking the number of tasks currently stored
 *
 * These are surfaced at GET /metrics and scraped by Prometheus (see prometheus/).
 */
const register = new client.Registry();

register.setDefaultLabels({ app: 'taskflow-api' });
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests handled',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

const tasksTotal = new client.Gauge({
  name: 'taskflow_tasks_total',
  help: 'Current number of tasks stored in the API',
  registers: [register],
});

/**
 * Express middleware that records request count and latency for every request.
 * Uses the matched route path (e.g. /api/tasks/:id) as a label so cardinality
 * stays bounded instead of exploding per-id.
 */
function metricsMiddleware(req, res, next) {
  const end = httpRequestDurationSeconds.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.baseUrl + req.route.path : req.path;
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    end(labels);
  });
  next();
}

module.exports = {
  register,
  metricsMiddleware,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  tasksTotal,
};
