// File: tests/load/heavy-load.js
// Heavy load stress test - Peak traffic with 1000 concurrent users
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics for business logic
const purchaseSuccess = new Counter('purchase_success_total');
const purchaseSoldOut = new Counter('purchase_sold_out_total');
const purchaseRateLimited = new Counter('purchase_rate_limited_total');
const purchaseErrors = new Counter('purchase_errors_total');
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp to 100 users
    { duration: '2m', target: 500 },  // Ramp to 500 users
    { duration: '3m', target: 1000 }, // Spike to 1000 users!
    { duration: '2m', target: 500 },  // Scale down
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],  // Allow higher latency under heavy load
    checks: ['rate>0.6'],  // 60% of checks must pass (accounts for 410 sold out)
    errors: ['rate<0.1'],  // Actual errors only (excludes 410 and 429)
    // Note: http_req_failed will still count 410, but 'checks' and 'errors' are more accurate
  },
};

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3001').trim();

export default function () {
  const userId = Math.floor(Math.random() * 50000);
  const skuId = Math.floor(Math.random() * 5) + 1;
  const idempotencyKey = `heavy-${userId}-${Date.now()}-${Math.random()}`;

  const payload = JSON.stringify({
    userId: userId.toString(),
    skuId: skuId.toString(),
    quantity: 1,
    idempotencyKey: idempotencyKey,
  });

  const response = http.post(
    `${BASE_URL}/api/v1/flash/purchase`,
    payload,
    { headers: { 'Content-Type': 'application/json' }, timeout: '15s' }
  );

  // Check logic: 200 and 410 are both valid/expected responses
  const success = check(response, {
    'status is 200 or 410': (r) => r.status === 200 || r.status === 410,
    'status is valid': (r) => [200, 410].includes(r.status),
    'status is 429 (rate limited)': (r) => r.status === 429,
  });

  // Track business metrics separately
  if (response.status === 200) {
    purchaseSuccess.add(1);
  } else if (response.status === 410) {
    purchaseSoldOut.add(1);
  } else if (response.status === 429) {
    purchaseRateLimited.add(1);
  } else if (response.status >= 500 || response.status === 0) {
    purchaseErrors.add(1);
    errorRate.add(1);
  }

  // Only count actual errors, not 410 (sold out) or 429 (rate limited)
  if (!success && response.status !== 410 && response.status !== 429) {
    errorRate.add(1);
  }

  sleep(Math.random() * 0.5);  // Minimal think time for maximum load
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

