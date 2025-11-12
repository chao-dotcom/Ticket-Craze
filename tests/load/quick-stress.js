// File: tests/load/quick-stress.js
// Quick 1-minute stress test - Perfect for quick validation
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '10s', target: 50 },   // Quick ramp to 50 users
    { duration: '20s', target: 200 },  // Ramp to 200 users
    { duration: '20s', target: 500 },  // Spike to 500 users
    { duration: '10s', target: 0 },    // Quick ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.1'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  const userId = Math.floor(Math.random() * 10000);
  const skuId = Math.floor(Math.random() * 5) + 1;  // 5 different SKUs
  const idempotencyKey = `quick-test-${userId}-${Date.now()}-${Math.random()}`;

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
    'status is 200': (r) => r.status === 200,
    'status is 410 (sold out)': (r) => r.status === 410,
    'status is 429 (rate limited)': (r) => r.status === 429,
    'has reservationId': (r) => r.status === 200 && JSON.parse(r.body).reservationId,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success && response.status !== 410 && response.status !== 429);

  sleep(Math.random() * 1 + 0.5);  // Shorter think time 0.5-1.5s for faster test
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

