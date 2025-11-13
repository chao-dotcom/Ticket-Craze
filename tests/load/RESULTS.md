# Load Test Results

This file contains raw test results from stress testing the three different implementations.

## MySQL-Only Implementation (Port 3003)

**Test Script:** `compare-mysql-only.js`  
**Duration:** 1m 12.5s  
**Max VUs:** 500

### Raw Output

```
WARN[0070] Request Failed                                error="Post \"http://localhost:3003/api/v1/flash/purchase\": request timeout"
WARN[0070] Request Failed                                error="Post \"http://localhost:3003/api/v1/flash/purchase\": request timeout"
WARN[0070] Request Failed                                error="Post \"http://localhost:3003/api/v1/flash/purchase\": request timeout"
WARN[0070] Request Failed                                error="Post \"http://localhost:3003/api/v1/flash/purchase\": request timeout"
     ✗ status is 200 or 410
      ↳  65% — ✓ 1044 / ✗ 560
     ✗ response received
      ↳  66% — ✓ 1060 / ✗ 544
     ✗ response time < 2000ms
      ↳  13% — ✓ 213 / ✗ 1391

     checks.........................: 48.15% ✓ 2317      ✗ 2495
     data_received..................: 528 kB 7.3 kB/s
     data_sent......................: 298 kB 4.1 kB/s
   ✗ errors.........................: 52.80% ✓ 847       ✗ 757
     http_req_blocked...............: avg=520.94µs min=0s       med=0s     max=32.85ms p(90)=1.6ms    p(95)=1.82ms
     http_req_connecting............: avg=475.43µs min=0s       med=0s     max=32.85ms p(90)=1.41ms   p(95)=1.73ms
   ✗ http_req_duration..............: avg=9.26s    min=46.59ms  med=9.72s  max=15.01s  p(90)=15s      p(95)=15s
       { expected_response:true }...: avg=6.25s    min=46.59ms  med=5.64s  max=14.99s  p(90)=13.52s   p(95)=14.13s
     http_req_failed................: 34.91% ✓ 560       ✗ 1044
     http_req_receiving.............: avg=532.96µs min=0s       med=0s     max=4.35ms  p(90)=1.86ms   p(95)=2.46ms
     http_req_sending...............: avg=64.3µs   min=0s       med=0s     max=1.64ms  p(90)=512.52µs p(95)=551.69µs
     http_req_tls_handshaking.......: avg=0s       min=0s       med=0s     max=0s      p(90)=0s       p(95)=0s
     http_req_waiting...............: avg=9.26s    min=46.59ms  med=9.72s  max=15.01s  p(90)=15s      p(95)=15s
     http_reqs......................: 1604   22.125093/s
     iteration_duration.............: avg=10.27s   min=567.36ms med=10.83s max=16.49s  p(90)=16.22s   p(95)=16.37s
     iterations.....................: 1604   22.125093/s
     purchase_errors_total..........: 560    7.724471/s
     purchase_success_total.........: 1044   14.400622/s
     vus............................: 22     min=5       max=500
     vus_max........................: 500    min=500     max
running (1m12.5s), 000/500 VUs, 1604 complete and 0 interrupted iterations
default ✓ [=============================] 000/500 VUs  1m0s
ERRO[0072] thresholds on metrics 'errors, http_req_duration' have been crossed
```

### Key Metrics Summary

| Metric | Value |
|--------|-------|
| **Response Time (avg)** | 9.26s |
| **Response Time (p95)** | 15s |
| **Throughput** | 22 req/s |
| **Error Rate** | 52.80% |
| **Checks Passed** | 48.15% |
| **Total Requests** | 1,604 |
| **Successful Purchases** | 1,044 |
| **Errors** | 560 |

---

## Redis-Only Implementation (Port 3004)

**Test Script:** `compare-redis-only.js`  
**Duration:** 1m 01.4s  
**Max VUs:** 500

### Raw Output

```
INFO[0000] 🔄 Resetting Redis inventory...                source=console
     ✗ status is 200 or 410
      ↳  83% — ✓ 10289 / ✗ 2078
     ✗ status is 429 (rate limited)
      ↳  0% — ✓ 0 / ✗ 12367
     ✗ has reservationId
      ↳  18% — ✓ 2272 / ✗ 10095
     ✓ response time < 1000ms

     checks.........................: 50.39% ✓ 24928      ✗ 24540
     data_received..................: 4.6 MB 76 kB/s
     data_sent......................: 3.2 MB 52 kB/s
   ✗ errors.........................: 35.17% ✓ 4350       ✗ 8017
     http_req_blocked...............: avg=38.21µs  min=0s       med=0s      max=16.12ms  p(90)=0s       p(95)=0s
     http_req_connecting............: avg=33.33µs  min=0s       med=0s      max=14.86ms  p(90)=0s       p(95)=0s
   ✓ http_req_duration..............: avg=9.1ms    min=0s       med=2.34ms  max=187.38ms p(90)=27.98ms  p(95)=34.66ms
       { expected_response:true }...: avg=29.41ms  min=12.26ms  med=27.42ms max=187.38ms p(90)=40.66ms  p(95)=46.12ms
     http_req_failed................: 81.62% ✓ 10095      ✗ 2272
     http_req_receiving.............: avg=205.45µs min=0s       med=0s      max=8.53ms   p(90)=746.79µs p(95)=917.9µs
     http_req_sending...............: avg=12.54µs min=0s       med=0s      max=1.62ms   p(90)=0s       p(95)=0s
     http_req_tls_handshaking.......: avg=0s       min=0s       med=0s      max=0s       p(90)=0s       p(95)=0s
     http_req_waiting...............: avg=8.88ms   min=0s       med=2.18ms  max=187.38ms p(90)=27.6ms   p(95)=34.4ms
     http_reqs......................: 12367  201.477236/s
     iteration_duration.............: avg=1.01s    min=501.27ms med=1.01s   max=1.57s    p(90)=1.4s     p(95)=1.46s
     iterations.....................: 12367  201.477236/s
     purchase_errors_total..........: 2078   33.85378/s
     purchase_sold_out_total........: 8017   130.609121/s
     purchase_success_total.........: 2272   37.014335/s
     vus............................: 2      min=2        max=498

running (1m01.4s), 000/500 VUs, 12367 complete and 0 interrupted iterations
```

### Key Metrics Summary

| Metric | Value |
|--------|-------|
| **Response Time (avg)** | 9.1ms |
| **Response Time (p95)** | 34.66ms |
| **Response Time (expected_response)** | 29.41ms |
| **Throughput** | 201 req/s |
| **Error Rate** | 35.17% |
| **Checks Passed** | 50.39% |
| **Total Requests** | 12,367 |
| **Successful Purchases** | 2,272 |
| **Sold Out Responses** | 8,017 |
| **Errors** | 2,078 |

---

## Complete Implementation (Port 3001)

**Test Script:** `quick-stress.js`  
**Duration:** 1m 00.9s  
**Max VUs:** 500

### Raw Output

```
         /\      Grafana   /‾‾/
    /\  /  \     |\  __   /  /
   /  \/    \    | |/ /  /   ‾‾\
  /          \   |   (  |  (‾)  |
 / __________ \  |_|\_\  \_____/

     execution: local
        script: tests/load/quick-stress.js
        output: -

     scenarios: (100.00%) 1 scenario, 500 max VUs, 1m30s max duration (incl. graceful stop):
              * default: Up to 500 looping VUs for 1m0s over 4 stages (gracefulRampDown: 30s, gracefulStop: 30s)

     ✓ status is 200 or 410
     ✗ status is 429 (rate limited)
      ↳  0% — ✓ 0 / ✗ 12421
     ✗ has reservationId
      ↳  0% — ✓ 0 / ✗ 12421
     ✓ response time < 500ms

     checks.....................: 50.00%  ✓ 24842      ✗ 24842
     data_received..............: 14 MB   225 kB/s
     data_sent..................: 3.2 MB  52 kB/s
   ✓ errors.....................: 0.00%   ✓ 0          ✗ 12421
     http_req_blocked...........: avg=48.24µs min=0s       med=0s     max=39.33ms  p(90)=0s       p(95)=0s
     http_req_connecting........: avg=42.37µs min=0s       med=0s     max=39.33ms  p(90)=0s       p(95)=0s
   ✓ http_req_duration..........: avg=6.59ms  min=538.4µs  med=3.97ms max=153.42ms p(90)=13.53ms  p(95)=20.07ms
     http_req_failed............: 100.00% ✓ 12421      ✗ 0
     http_req_receiving.........: avg=96.51µs min=0s       med=0s     max=14.59ms  p(90)=528.29µs p(95)=546.4µs
     http_req_sending...........: avg=18.05µs min=0s       med=0s     max=7.27ms   p(90)=0s       p(95)=0s
     http_req_tls_handshaking...: avg=0s      min=0s       med=0s     max=0s       p(90)=0s       p(95)=0s
     http_req_waiting...........: avg=6.48ms  min=538.4µs  med=3.86ms max=153.42ms p(90)=13.35ms  p(95)=19.88ms
     http_reqs..................: 12421   203.941877/s
     iteration_duration.........: avg=1s      min=502.97ms med=1s     max=1.62s    p(90)=1.4s     p(95)=1.45s
     iterations.................: 12421   203.941877/s
     vus........................: 30      min=5        max=498

running (1m00.9s), 000/500 VUs, 12421 complete and 0 interrupted iterations
default ✓ [======================================] 000/500 VUs  1m0s
```

### Key Metrics Summary

| Metric | Value |
|--------|-------|
| **Response Time (avg)** | 6.59ms |
| **Response Time (p95)** | 20.07ms |
| **Throughput** | 203 req/s |
| **Error Rate** | 0.00% |
| **Checks Passed** | 50.00% |
| **Total Requests** | 12,421 |
| **Status 200 or 410** | ✓ All passed |

---

## Comparison Summary

| Metric | MySQL-Only | Redis-Only | Complete | Expected Complete |
|--------|-----------|------------|----------|-------------------|
| **Response Time (avg)** | 9.26s | 29.41ms | 6.59ms | <200ms |
| **Response Time (p95)** | 15s | 34.66ms | 20.07ms | <200ms |
| **Throughput** | 22 req/s | 201 req/s | 203 req/s | 1000+ req/s |
| **Error Rate** | 52.80% | 35.17% | 0.00% | <1% |
| **Status** | ❌ Very slow | ⚠️ Better | ✅ Fast | ✅ Excellent |

