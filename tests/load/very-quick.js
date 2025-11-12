// File: tests/load/very-quick.js
// Very quick 30-second stress test - For rapid testing
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '5s', target: 100 },   // Quick ramp to 100 users
    { duration: '15s', target: 500 },  // Spike to 500 users
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
  const skuId = Math.floor(Math.random() * 5) + 1;
  const idempotencyKey = `very-quick-${userId}-${Date.now()}-${Math.random()}`;

  const payload = JSON.stringify({
    userId: userId.toString(),
    skuId: skuId.toString(),
    quantity: 1,
    idempotencyKey: idempotencyKey,
  });

  const response = http.post(
    `${BASE_URL}/api/v1/flash/purchase`,
    payload,
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s',
    }
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'status is 410 (sold out)': (r) => r.status === 410,
    'status is 429 (rate limited)': (r) => r.status === 429,
    'has reservationId': (r) => r.status === 200 && JSON.parse(r.body).reservationId,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!check(response, { 'status is valid': (r) => [200, 410, 429].includes(r.status) }) && response.status !== 410 && response.status !== 429);

  sleep(0.5);  // Minimal think time for maximum speed
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

