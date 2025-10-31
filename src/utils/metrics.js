// File: src/utils/metrics.js
const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Enable default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const purchaseAttempts = new client.Counter({
  name: 'purchase_attempts_total',
  help: 'Total number of purchase attempts',
  labelNames: ['status', 'reason']
});

const inventoryOperations = new client.Counter({
  name: 'inventory_operations_total',
  help: 'Total number of inventory operations',
  labelNames: ['operation', 'result']
});

const kafkaProduceLatency = new client.Histogram({
  name: 'kafka_produce_latency_seconds',
  help: 'Kafka message produce latency',
  labelNames: ['topic'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

const redisOperationDuration = new client.Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Redis operation duration',
  labelNames: ['operation'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1]
});

const activeReservations = new client.Gauge({
  name: 'active_reservations',
  help: 'Number of active reservations',
  labelNames: ['sku_id']
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(purchaseAttempts);
register.registerMetric(inventoryOperations);
register.registerMetric(kafkaProduceLatency);
register.registerMetric(redisOperationDuration);
register.registerMetric(activeReservations);

module.exports = {
  register,
  metrics: {
    httpRequestDuration,
    purchaseAttempts,
    inventoryOperations,
    kafkaProduceLatency,
    redisOperationDuration,
    activeReservations
  }
};

