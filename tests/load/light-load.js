// File: tests/load/light-load.js
// Light load stress test - Warm-up test with 50 concurrent users
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // 10 concurrent users
    { duration: '1m', target: 50 },    // Ramp to 50 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export default function () {
  const userId = Math.floor(Math.random() * 10000);
  const skuId = Math.floor(Math.random() * 5) + 1;
  const idempotencyKey = `stress-${userId}-${Date.now()}-${Math.random()}`;

  const payload = JSON.stringify({
    userId: userId.toString(),
    skuId: skuId.toString(),
    quantity: 1,
    idempotencyKey: idempotencyKey,
  });

  const response = http.post(
    `${BASE_URL}/api/v1/flash/purchase`,
    payload,
    { headers: { 'Content-Type': 'application/json' }, timeout: '10s' }
  );

  const success = check(response, {
    'status is 200 or 410': (r) => r.status === 200 || r.status === 410,
    'status is 429 (rate limited)': (r) => r.status === 429,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}

