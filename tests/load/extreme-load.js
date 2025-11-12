// File: tests/load/extreme-load.js
// Extreme load stress test - Breaking point test with 2000+ concurrent users
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 500 },
    { duration: '1m', target: 1000 },
    { duration: '2m', target: 2000 },  // Extreme load!
    { duration: '1m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // Very lenient
    http_req_failed: ['rate<0.2'],  // Allow 20% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export default function () {
  const userId = Math.floor(Math.random() * 100000);
  const skuId = Math.floor(Math.random() * 5) + 1;
  const idempotencyKey = `extreme-${userId}-${Date.now()}-${Math.random()}`;

  const payload = JSON.stringify({
    userId: userId.toString(),
    skuId: skuId.toString(),
    quantity: 1,
    idempotencyKey: idempotencyKey,
  });

  const response = http.post(
    `${BASE_URL}/api/v1/flash/purchase`,
    payload,
    { headers: { 'Content-Type': 'application/json' }, timeout: '20s' }
  );

  check(response, {
    'got response': (r) => r.status !== 0,
  });
}

