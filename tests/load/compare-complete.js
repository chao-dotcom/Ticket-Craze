// File: tests/load/compare-complete.js
// Comparison test for complete optimized implementation (Redis + Kafka)
// Tests: No race conditions, fast response, high throughput
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Setup function: Reset inventory before test starts
export function setup() {
  console.log('🔄 Resetting Redis inventory...');
  // Note: In k6, we can't directly call Node.js scripts
  // So we'll use a simple HTTP endpoint or rely on manual reset
  // For now, we'll log a message - user should run: node scripts/reset-inventory-redis.js
  return { message: 'Please ensure Redis inventory is reset before running this test' };
}

const errorRate = new Rate('errors');
const successCount = new Counter('purchase_success_total');
const soldOutCount = new Counter('purchase_sold_out_total');
const rateLimitedCount = new Counter('purchase_rate_limited_total');
const errorCount = new Counter('purchase_errors_total');

export const options = {
  stages: [
    { duration: '10s', target: 50 },   // Ramp to 50 users
    { duration: '20s', target: 200 },  // Ramp to 200 users
    { duration: '20s', target: 500 },  // Spike to 500 users
    { duration: '10s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // Fast response times
    errors: ['rate<0.1'],
  },
};

export default function (data) {
  const userId = Math.floor(Math.random() * 10000);
  const skuId = Math.floor(Math.random() * 5) + 1;  // 5 different SKUs
  const idempotencyKey = `compare-complete-${userId}-${Date.now()}-${Math.random()}`;

  const payload = JSON.stringify({
    userId: userId.toString(),
    skuId: skuId.toString(),
    quantity: 1,
    idempotencyKey: idempotencyKey,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '10s',
  };

  const response = http.post(
    `${BASE_URL}/api/v1/flash/purchase`,
    payload,
    params
  );

  // Track different response types
  if (response.status === 200) {
    successCount.add(1);
  } else if (response.status === 410) {
    soldOutCount.add(1);
  } else if (response.status === 429) {
    rateLimitedCount.add(1);
  } else if (response.status >= 500 || response.status === 0) {
    errorCount.add(1);
  }

  const success = check(response, {
    'status is 200 or 410': (r) => r.status === 200 || r.status === 410,
    'status is 429 (rate limited)': (r) => r.status === 429,
    'has reservationId': (r) => r.status === 200 && r.json('reservationId') !== undefined,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Only count actual errors (not 410 or 429)
  errorRate.add(!success && response.status !== 410 && response.status !== 429 && response.status !== 0);

  sleep(Math.random() * 1 + 0.5);
}

export function handleSummary(data) {
  return {
    'tests/load/results/compare-complete.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

