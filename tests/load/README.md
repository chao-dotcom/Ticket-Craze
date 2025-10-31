# Load Testing Guide

This directory contains load testing scripts for the Flash Sale Ticketing System using k6.

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
