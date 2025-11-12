// File: tests/load/purchase.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 200 },   // Ramp up to 200 users
    { duration: '2m', target: 500 },   // Flash sale spike!
    { duration: '1m', target: 200 },   // Scale down
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% < 500ms, 99% < 1s
    errors: ['rate<0.1'],  // Actual errors only (410 and 429 excluded)
    // Note: http_req_failed will still count 410, but that's okay for monitoring
    // The important metric is 'errors' which excludes expected responses
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';

export default function () {
  const userId = Math.floor(Math.random() * 10000);
  const skuId = Math.floor(Math.random() * 5) + 1;  // 5 different SKUs
  const idempotencyKey = `load-test-${userId}-${Date.now()}-${Math.random()}`;

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

  const success = check(response, {
    'status is 200 or 410': (r) => r.status === 200 || r.status === 410,
    'status is 429 (rate limited)': (r) => r.status === 429,
    'has reservationId': (r) => r.status === 200 && r.json('reservationId') !== undefined,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Only count actual errors, not 410 (sold out) or 429 (rate limited)
  errorRate.add(!success && response.status !== 410 && response.status !== 429);

  sleep(Math.random() * 2 + 1);  // Random think time 1-3s
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

