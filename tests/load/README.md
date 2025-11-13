# Load Testing Guide

This directory contains load testing scripts for the Flash Sale Ticketing System using k6.

> **For comparison testing between MySQL-only, Redis-only, and Complete implementations, see [COMPARE_README.md](./COMPARE_README.md)**

## Contents

- **General Load Tests**: `purchase.js`, `quick-stress.js`, `heavy-load.js`, etc.
- **Comparison Tests**: `compare-mysql-only.js`, `compare-redis-only.js`, `compare-complete.js`
- **Documentation**: `COMPARE_README.md` (comparison guide), `README.md` (this file)
- **Test Results**: `RESULTS.md` (raw test outputs)

## Comparison Summary

The following table compares the performance of three different implementations under stress testing:

| Metric | MySQL-Only | Redis-Only | Complete (Your Results) | Expected Complete |
|--------|-----------|------------|------------------------|-------------------|
| **Response Time** | 9.26s | 29.41ms | 6.59ms | <200ms |
| **Throughput** | 22 req/s | 201 req/s | 203 req/s | 1000+ req/s |
| **Error Rate** | 52.80% | 35.17% | 0.00% | <1% |
| **Status** | ❌ Very slow | ⚠️ Better | ✅ Fast | ✅ Excellent |

To see successful stress test results and detailed comparison, see [COMPARE_README.md](./COMPARE_README.md).

## Load Testing with k6

k6 is used for high-performance load testing with simple JavaScript syntax.

### Prerequisites

- [k6](https://k6.io/docs/getting-started/installation/) installed locally
- System running and accessible at `http://localhost`

### Running Load Tests

```bash
npm run test:load
```

Or directly:
```bash
k6 run tests/load/purchase.js
```

### Test Configuration

The test script (`purchase.js`) is configured with:
- **Stages**: Gradual ramp-up from 50 → 200 → 500 users
- **Duration**: 5 minutes total test time
- **Think Time**: 1-3 seconds random delay between requests
- **Target**: `/api/v1/flash/purchase`
- **Random SKUs**: Tests all 5 SKU IDs (1-5)
- **Unique Users**: Random userId from 1-10000

### Expected Performance Targets

- **Throughput**: 1000+ requests/second
- **Response Time (p95)**: < 500ms
- **Error Rate**: < 5%
- **Success Rate**: > 95% (excluding expected 410 Sold Out, 429 Rate Limited)

### Customizing Test Load

Edit `tests/load/purchase.js` or use environment variables:

```bash
# Change base URL
BASE_URL=http://localhost:3001 k6 run tests/load/purchase.js

# Change target endpoint
ENDPOINT=/api/v1/flash/purchase k6 run tests/load/purchase.js
```

### Viewing Results

k6 displays results in the console with:
- **Throughput**: Requests per second
- **Response Times**: Min, Avg, p95, p99, Max
- **Error Rate**: Percentage of failed requests
- **Response Code Distribution**: Count of each HTTP status code

Results are also saved to:
- `summary.json`: JSON summary of test results
- Console output: Colorized text summary

### Performance Benchmarking

#### Baseline vs. Load Balanced Comparison

To demonstrate the throughput improvement from Nginx load balancing:

1. **Test without Nginx** (direct to single API instance):
   ```bash
   BASE_URL=http://localhost:3001 k6 run tests/load/purchase.js
   ```

2. **Test with Nginx** (through load balancer):
   ```bash
   BASE_URL=http://localhost k6 run tests/load/purchase.js
   ```

3. **Compare Results**: 
   - Baseline throughput: ~1000 req/sec
   - Load balanced throughput: Higher throughput due to load distribution
   - Improvement: Better resource utilization across API instances

## K6 Testing/Interpretation

### Heavy Load Test Results

![Heavy Load Test Results](../asset/heavy-load-result.png)

### 🚀 Load Test Summary (k6)

#### Test Setup

| Item | Value |
|------|-------|
| Duration | 9m 30s (5-stage ramp up/down) |
| Virtual Users (max) | 1000 |
| Total Requests | 612,839 |
| Throughput | ~1,135 req/s |
| Success Criteria | Status 200 (success) or 410 (sold out) |

#### 📊 Key Results

| Metric | Description | Result | Interpretation |
|--------|-------------|--------|----------------|
| ✅ Checks Passed | Requests meeting success condition (200 or 410) | 66.66 % | Expected — majority correctly returned 410 when sold out |
| 🛒 purchase_success_total | Successful purchases | 4,350 | Matches expected inventory (successful orders) |
| 🚫 purchase_sold_out_total | "Sold out" responses | 608,489 | Expected behavior after inventory depletion |
| ⚡ http_req_duration (avg) | Average response time per request | 204 ms | Excellent latency under load |
| 💥 http_req_failed | Requests not 2xx (includes 410) | 99.29 % | Misleading — these are logical fails, not server errors |
| 🌐 Throughput | Requests processed per second | ~1.1 k req/s | Strong sustained throughput |
| 🔒 Errors | Network / script errors | 0 | No infrastructure errors detected |

## Tips for Accurate Testing

1. **Warm-up Period**: Allow system to stabilize (first 30-60 seconds of test)
2. **Multiple Runs**: Run tests 3-5 times and average results
3. **System Resources**: Monitor CPU, memory, and network during tests
4. **Clean State**: Reset Redis inventory between test runs:
   ```bash
   docker-compose exec api-1 npm run setup:redis
   ```
5. **Network**: Ensure low network latency (< 10ms to target)

## Troubleshooting

- **Connection Refused**: Ensure services are running (`docker-compose ps`)
- **High Error Rate**: Check Redis/Kafka/MySQL health
- **Low Throughput**: Verify Nginx is routing to both API instances
- **k6 Not Found**: Install k6 from https://k6.io/docs/getting-started/installation/
