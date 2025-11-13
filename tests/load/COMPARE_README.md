# Comparison Stress Testing Guide

This guide explains how to stress test and compare three different implementations of the flash sale system to demonstrate why the optimized architecture is necessary.

## Overview

The comparison tests evaluate three approaches:

1. **MySQL-Only** (Most Naive) - Port 3003
   - Direct MySQL read-then-write operations
   - Demonstrates race conditions and overselling
   - Shows performance bottlenecks

2. **Redis-Only (No Kafka)** (Middle Ground) - Port 3004
   - Redis atomic operations for inventory
   - Synchronous MySQL writes for orders
   - Shows improvement but still has bottlenecks

3. **Complete (Redis + Kafka)** (Optimized) - Port 3001
   - Redis atomic operations for inventory
   - Async Kafka processing for orders
   - Production-grade performance

## Quick Start

### 1. Prerequisites

- [k6](https://k6.io/docs/getting-started/installation/) installed
- Docker Compose running (for MySQL, Redis, Kafka)
- Node.js installed

### 2. Start All Servers

Open three separate terminals:

```bash
# Terminal 1: MySQL-only server
node src/naive-server.js

# Terminal 2: Redis-only server
node src/naive-no-kafka-server.js

# Terminal 3: Complete server (via docker-compose)
# Already running on port 3001 via docker-compose up -d
```

**Verify servers are running:**

```powershell
# Windows
Invoke-RestMethod -Uri http://localhost:3003/health  # MySQL-only
Invoke-RestMethod -Uri http://localhost:3004/health  # Redis-only
Invoke-RestMethod -Uri http://localhost:3001/health  # Complete
```

```bash
# Mac/Linux
curl http://localhost:3003/health  # MySQL-only
curl http://localhost:3004/health  # Redis-only
curl http://localhost:3001/health  # Complete
```

### 3. Reset Inventory

**IMPORTANT:** Reset inventory before each test for fair comparison.

```bash
# Reset MySQL inventory (for MySQL-only test)
node scripts/reset-inventory-mysql.js

# Reset Redis inventory (for Redis-only and Complete tests)
node scripts/reset-inventory-redis.js
```

### 4. Run Stress Tests

Run each comparison test individually:

```bash
# Test 1: MySQL-Only (Most Naive)
k6 run tests/load/compare-mysql-only.js

# Test 2: Redis-Only (No Kafka)
k6 run tests/load/compare-redis-only.js

# Test 3: Complete (Redis + Kafka)
k6 run tests/load/compare-complete.js
```

**Note:** Reset inventory between tests if you want to see successful purchases in each test.

## Expected Results

### MySQL-Only (Port 3003)

**Architecture:**
- Inventory stored in MySQL
- SELECT then UPDATE (non-atomic)
- Single database connection
- Synchronous order creation

**Problems:**
- ❌ **Race conditions** - Multiple requests see same inventory
- ❌ **Overselling** - Stock goes negative
- ❌ **Very slow** - 9+ seconds average response time
- ❌ **High error rate** - 50%+ errors (timeouts, connection failures)
- ❌ **Low throughput** - ~10-50 req/sec

**Typical Metrics:**
- Response time p95: 9-15 seconds
- Throughput: 20-50 req/sec
- Error rate: 50-60%
- Success rate: 30-40%
- Overselling: **Yes** (check inventory after test)

### Redis-Only (Port 3004)

**Architecture:**
- Inventory in Redis (atomic operations)
- Synchronous MySQL writes for orders
- Connection pooling for MySQL
- Redis idempotency and rate limiting

**Improvements:**
- ✅ **No race conditions** - Atomic Redis Lua scripts
- ✅ **No overselling** - Atomic operations prevent conflicts
- ⚠️ **Still slow** - 200-500ms response times (waits for MySQL writes)
- ⚠️ **Limited throughput** - ~100-200 req/sec (DB bottleneck)
- ⚠️ **Higher error rate** - 30-40% (MySQL connection issues)

**Typical Metrics:**
- Response time p95: 200-500ms
- Throughput: 100-200 req/sec
- Error rate: 30-40%
- Success rate: 60-70%
- Overselling: **No** (atomic operations work)

### Complete (Port 3001)

**Architecture:**
- Inventory in Redis (atomic operations)
- Async Kafka events for order processing
- Worker processes handle MySQL writes
- Full production-grade setup

**Optimized:**
- ✅ **No race conditions** - Atomic Redis operations
- ✅ **No overselling** - Atomic Lua scripts
- ✅ **Fast** - <200ms response times
- ✅ **High throughput** - 1000+ req/sec
- ✅ **Low error rate** - <1% errors

**Typical Metrics:**
- Response time p95: <200ms (often <20ms)
- Throughput: 1000+ req/sec
- Error rate: <1%
- Success rate: 99%+
- Overselling: **No** (atomic operations)

## Performance Comparison Table

| Metric | MySQL-Only | Redis-Only | Complete | Improvement |
|--------|-----------|------------|----------|-------------|
| **Response Time (p95)** | 9-15s | 200-500ms | <200ms | **50-75x faster** |
| **Throughput** | 20-50 req/s | 100-200 req/s | 1000+ req/s | **20-50x better** |
| **Error Rate** | 50-60% | 30-40% | <1% | **50-60x lower** |
| **Success Rate** | 30-40% | 60-70% | 99%+ | **2-3x better** |
| **Overselling** | ❌ Yes | ✅ No | ✅ No | **Critical fix** |
| **Race Conditions** | ❌ Yes | ✅ No | ✅ No | **Critical fix** |

## Test Configuration

All three comparison tests use the same load pattern for fair comparison:

- **Duration**: 60 seconds total
- **Stages**:
  - 10s: Ramp to 50 users
  - 20s: Ramp to 200 users
  - 20s: Spike to 500 users
  - 10s: Ramp down to 0
- **Think Time**: 0.5-1.5 seconds between requests
- **SKUs**: Random selection from 5 SKUs
- **Users**: Random userId from 1-10000

## Understanding the Results

### Key Metrics Explained

1. **Response Time (p95, p99)**
   - Time from request sent to response received
   - Lower is better
   - MySQL-only: Very high (9+ seconds) due to DB bottleneck
   - Redis-only: Medium (200-500ms) due to synchronous DB writes
   - Complete: Low (<200ms) due to async processing

2. **Throughput (req/sec)**
   - Number of requests processed per second
   - Higher is better
   - MySQL-only: Very low (20-50) due to single connection
   - Redis-only: Medium (100-200) limited by DB writes
   - Complete: High (1000+) due to async processing

3. **Error Rate**
   - Percentage of requests that fail
   - Lower is better
   - MySQL-only: Very high (50%+) due to timeouts
   - Redis-only: Medium (30-40%) due to DB connection issues
   - Complete: Low (<1%) due to resilience

4. **Success Rate**
   - Percentage of requests that succeed (200 status)
   - Higher is better
   - Note: 410 (sold out) is expected, not an error

5. **Overselling**
   - Selling more items than available
   - MySQL-only: Yes (check inventory after test - will be negative)
   - Redis-only: No (atomic operations prevent it)
   - Complete: No (atomic operations prevent it)

### Interpreting Test Output

**Good Signs:**
- ✅ Low response times (<200ms for Complete)
- ✅ High throughput (1000+ req/s for Complete)
- ✅ Low error rate (<1% for Complete)
- ✅ No overselling (inventory stays non-negative)

**Warning Signs:**
- ⚠️ High response times (>500ms)
- ⚠️ Low throughput (<100 req/s)
- ⚠️ High error rate (>10%)
- ⚠️ Negative inventory (overselling)

## Verifying Results

### Check Inventory After Tests

**MySQL-Only (should show negative values - overselling):**
```powershell
# Windows
Invoke-RestMethod -Uri http://localhost:3003/api/v1/flash/inventory
```

```bash
# Mac/Linux
curl http://localhost:3003/api/v1/flash/inventory
```

**Redis-Only and Complete (should show accurate, non-negative values):**
```bash
docker-compose exec redis redis-cli GET inv:sku:1
docker-compose exec redis redis-cli GET inv:sku:2
# ... etc
```

### Check Test Results

Results are saved in JSON format:
- `tests/load/results/compare-mysql-only.json`
- `tests/load/results/compare-redis-only.json`
- `tests/load/results/compare-complete.json`

Compare these files to see detailed performance differences.

## Troubleshooting

### Connection Refused Errors

**Error:**
```
dial tcp 127.0.0.1:3003: connectex: No connection could be made because the target machine actively refused it
```

**Solution:**
The server isn't running. Start it:
```bash
# Start MySQL-only server
node src/naive-server.js

# Start Redis-only server
node src/naive-no-kafka-server.js
```

### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3003
```

**Solution:**
Find and stop the process using the port:
```powershell
# Windows - Find process on port 3003
Get-NetTCPConnection -LocalPort 3003 | Select-Object OwningProcess
# Then stop it: Stop-Process -Id <PID> -Force
```

```bash
# Mac/Linux - Find and kill process on port 3003
lsof -ti:3003 | xargs kill -9
```

### MySQL Connection Errors

**Error:**
```
ECONNREFUSED - Cannot connect to MySQL
```

**Solution:**
Start MySQL via Docker Compose:
```bash
docker-compose up -d mysql
```

Wait a few seconds for MySQL to be ready, then try again.

### Results Directory Not Found

**Error:**
```
could not open 'results/compare-mysql-only.json': The system cannot find the path specified
```

**Solution:**
Create the directory:
```bash
mkdir -p tests/load/results
```

Or k6 will create it automatically on first run.

### All Requests Return 410 (Sold Out)

**Symptom:**
- 100% of requests return 410 status
- No successful purchases (200 status)

**Solution:**
Inventory is exhausted. Reset it:
```bash
node scripts/reset-inventory-redis.js  # For Redis-based implementations
node scripts/reset-inventory-mysql.js  # For MySQL-only
```

### High Error Rate

**Symptom:**
- Error rate > 20%
- Many connection timeouts

**Possible Causes:**
1. **Server not running** - Check if servers are running
2. **Database overloaded** - MySQL can't handle the load (expected for MySQL-only)
3. **Network issues** - Check network connectivity
4. **Resource exhaustion** - Check CPU/memory usage

**Solutions:**
- For MySQL-only: High error rate is expected (50%+)
- For Redis-only: Should be lower (30-40%)
- For Complete: Should be very low (<1%)

## Key Takeaways

1. **MySQL-Only Fails Under Load**
   - Race conditions cause overselling
   - Single connection creates bottleneck
   - Response times become unacceptable (9+ seconds)

2. **Redis Solves Race Conditions**
   - Atomic operations prevent overselling
   - But synchronous DB writes still limit performance
   - Better than MySQL-only, but not production-ready

3. **Complete System Achieves Production Performance**
   - Atomic Redis operations prevent race conditions
   - Async Kafka processing enables high throughput
   - Sub-200ms response times under load
   - 1000+ req/sec sustained throughput

## Next Steps

After running the comparison tests:

1. **Review Results** - Compare the three JSON result files
2. **Check Inventory** - Verify MySQL-only shows overselling
3. **Analyze Performance** - See the dramatic improvement with each optimization
4. **Read Architecture Docs** - Understand why each component is needed:
   - `guide/NAIVE_VS_OPTIMIZED.md` - Detailed comparison
   - `README.md` - System overview

## Additional Resources

- **Load Testing Guide**: `README.md` in this directory
- **Architecture Comparison**: `guide/NAIVE_VS_OPTIMIZED.md`
- **System Design**: Main `README.md`
- **k6 Documentation**: https://k6.io/docs/
