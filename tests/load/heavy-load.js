// File: tests/load/heavy-load.js
// Heavy load stress test - Peak traffic with 1000 concurrent users
import http from 'k6/http';
import { check, sleep } from 'k6';

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
    http_req_failed: ['rate<0.1'],  // Allow up to 10% errors (sold out, rate limited)
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

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

  check(response, {
    'status is valid': (r) => [200, 410, 429, 500].includes(r.status),
  });

  sleep(Math.random() * 0.5);  // Minimal think time for maximum load
}

