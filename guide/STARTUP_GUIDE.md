# Ticket Craze - Startup Guide

This guide will walk you through starting up the Ticket Craze flash sale system from scratch. We'll cover everything step by step, explaining what each command does and why it's needed.

## Prerequisites

Before you begin, make sure you have:

1. **Docker Desktop** installed and running
   - Download from: https://www.docker.com/products/docker-desktop
   - Make sure Docker is running (you should see the Docker icon in your system tray)

2. **Git** (optional, if cloning the repository)
   - Most systems come with Git pre-installed

3. **Terminal/Command Prompt**
   - Windows: PowerShell or Command Prompt
   - Mac/Linux: Terminal

That's it! You don't need Node.js, npm, or any other tools installed locally - everything runs in Docker containers.

---

## Step 1: Verify Docker is Running

First, let's make sure Docker is working:

```bash
docker --version
docker-compose --version
```

You should see version numbers. If you get an error, make sure Docker Desktop is running.

---

## Step 2: Navigate to Project Directory

Open your terminal and navigate to the Ticket-Craze project folder:

```bash
cd path/to/Ticket-Craze
```

Or if you're already in the project folder, you can skip this step.

---

## Step 3: Start All Services

This is the main command that starts everything. Let's break it down:

```bash
docker-compose up -d --build
```

**What this does:**
- `docker-compose up` - Starts all services defined in `docker-compose.yml`
- `-d` - Runs in "detached" mode (runs in background, doesn't block your terminal)
- `--build` - Builds the Docker images if they don't exist or if code changed

**What gets started:**
1. **Redis** - Stores inventory and reservations (port 6380)
2. **MySQL** - Database for orders (port 3307)
3. **Zookeeper** - Required for Kafka coordination (port 2182)
4. **Kafka** - Message queue for events (ports 9092, 9093)
5. **Kafka UI** - Web interface to view Kafka topics (port 8080)
6. **API Server 1** - First Express API instance (port 3001)
7. **API Server 2** - Second Express API instance (port 3002)
8. **Order Worker** - Processes reservations from Kafka
9. **Nginx** - Load balancer (port 80)
10. **Prometheus** - Metrics collection (port 9091)
11. **Grafana** - Metrics visualization (port 3000)

**Expected output:**
You'll see Docker downloading images (first time only) and starting containers. It should end with something like:
```
Container ticket-craze-redis-1  Started
Container ticket-craze-mysql-1  Started
...
```

**Wait time:** This can take 1-3 minutes the first time (downloading images). Subsequent starts are much faster (10-30 seconds).

---

## Step 4: Check Service Status

Let's verify all services are running:

```bash
docker-compose ps
```

**What to look for:**
- All services should show "Up" status
- Health checks should show "healthy" for Redis, MySQL, and Kafka

**If something is down:**
```bash
# Check logs for a specific service
docker-compose logs redis
docker-compose logs mysql
docker-compose logs kafka
```

---

## Step 5: Setup Kafka Topics

Kafka needs topics (like message channels) to be created before the system can use them. We'll run this inside the `api-1` container:

```bash
docker-compose exec api-1 npm run setup:kafka
```

**What this does:**
- `docker-compose exec api-1` - Runs a command inside the `api-1` container
- `npm run setup:kafka` - Executes the Kafka topic setup script

**Expected output:**
```
Connected to Kafka
Topics created successfully
Available topics: [ 'reservations', 'order-dead-letter', 'payments', 'orders' ]
```

**What topics are created:**
- `reservations` - New ticket reservations
- `orders` - Orders ready for payment processing
- `payments` - Payment events
- `order-dead-letter` - Failed orders that need manual review

**Why this step is needed:**
Kafka doesn't auto-create topics in production mode (for safety). We need to explicitly create them.

---

## Step 6: Initialize Redis Inventory

Now we need to set up the initial inventory in Redis. This tells the system how many tickets are available for each SKU (product):

```bash
docker-compose exec api-1 npm run setup:redis
```

**What this does:**
- Connects to Redis
- Loads Lua scripts (for atomic operations)
- Initializes inventory for SKUs 1-5 with stock quantities

**Expected output:**
```
Connected to Redis
Loaded Lua scripts: { ... }
Initialized inventory for SKU 1: 1000
Initialized inventory for SKU 2: 500
Initialized inventory for SKU 3: 2000
Initialized inventory for SKU 4: 750
Initialized inventory for SKU 5: 100
Inventory initialization complete
```

**What gets created:**
- Redis keys like `inv:sku:1`, `inv:sku:2`, etc. with stock counts
- Lua scripts loaded for atomic inventory operations

**Why this step is needed:**
The system needs to know how many tickets are available. Without this, all purchase requests would fail with "sold out".

---

## Step 7: Verify System is Working

Let's test that everything is working:

### 7.1 Test Health Endpoint

```bash
curl http://localhost:3001/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-31T22:43:34.050Z",
  "uptime": 14.57
}
```

**If using PowerShell (Windows):**
```powershell
Invoke-RestMethod -Uri http://localhost:3001/health
```

### 7.2 Test Purchase Endpoint

**On Windows (PowerShell - Recommended):**
```powershell
Invoke-RestMethod -Uri http://localhost/api/v1/flash/purchase -Method POST -ContentType "application/json" -Body '{"userId":"123","skuId":"1","quantity":1,"idempotencyKey":"test-1"}'
```

**On Mac/Linux (or Windows with curl.exe):**
```bash
curl -X POST http://localhost/api/v1/flash/purchase \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"123\",\"skuId\":\"1\",\"quantity\":1,\"idempotencyKey\":\"test-1\"}"
```

**Expected response:**
```json
{
  "success": true,
  "reservationId": "643853410013024256",
  "orderId": "643853410017218560",
  "expiresAt": 1762966115166,
  "message": "Reservation confirmed. Complete payment within 5 minutes.",
  "processingTimeMs": 132
}
```

**⚠️ Important for Windows Users:**
- **Don't use** `curl` in Command Prompt or PowerShell (it's an alias that doesn't handle JSON properly)
- **Use** `Invoke-RestMethod` in PowerShell (shown above)
- **Or use** `curl.exe` with escaped quotes: `curl.exe -X POST ... -d "{\"userId\":\"123\",...}"`

**What this tests:**
- Nginx is routing requests correctly
- API servers are responding
- Redis inventory is working
- Kafka events are being published
- The entire purchase flow is functional

---

## Step 8: Access Monitoring Tools (Optional)

The system includes monitoring tools you can explore:

### Kafka UI
- **URL:** http://localhost:8080
- **What it shows:** Kafka topics, messages, consumer groups
- **Use case:** Debug message flow, see events in real-time

### Prometheus
- **URL:** http://localhost:9091
- **What it shows:** Metrics endpoint, query interface
- **Use case:** Query system metrics, see request rates
- **Note:** Port 9091 maps to Prometheus's internal port 9090

### Grafana
- **URL:** http://localhost:3000
- **Login:** admin / admin
- **What it shows:** Visual dashboards of system metrics
- **Use case:** Monitor system health, performance graphs

---

## Step 9: Run Stress Tests (Optional)

Once your system is running, you can stress test it to see how it performs under load:

### Prerequisites for Stress Testing

1. **Install k6** (load testing tool):
   - **Windows**: Download from https://k6.io/docs/getting-started/installation/windows/
   - **Mac**: `brew install k6`
   - **Linux**: See https://k6.io/docs/getting-started/installation/

2. **Verify k6 is installed:**
   ```bash
   k6 version
   ```

### Quick Stress Test (1 minute)

```bash
# Run a quick 1-minute stress test (bypasses Nginx, tests directly)
k6 run tests/load/quick-stress.js
```

This test:
- Ramps up to 500 concurrent users
- Runs for 1 minute
- Tests directly against API server (port 3001)
- Shows throughput, response times, and success rates

### Heavy Load Test (9 minutes)

```bash
# Run a comprehensive heavy load test
k6 run tests/load/heavy-load.js
```

This test:
- Ramps up to 1000 concurrent users
- Runs for 9 minutes
- Tests system limits and sustained performance
- Provides detailed metrics

### Viewing Test Results

After running a test, you'll see:
- **Throughput**: Requests per second
- **Response Times**: Min, Avg, p95, p99, Max
- **Success Rate**: Percentage of successful requests
- **Business Metrics**: Successful purchases vs sold out responses

**For detailed interpretation and more test scenarios**, see the [Load Testing Guide](../tests/load/README.md).

**Note:** Make sure to reset inventory before each test:
```bash
docker-compose exec api-1 npm run setup:redis
```

---

## Common Issues and Solutions

### Issue: Port Already in Use

**Error:** `Bind for 0.0.0.0:XXXX failed: port is already allocated`

**Solution:** 
1. Check what's using the port:
   ```bash
   # Windows
   netstat -ano | findstr :XXXX
   
   # Mac/Linux
   lsof -i :XXXX
   ```
2. Either stop the conflicting service or change the port in `docker-compose.yml`

### Issue: Container Won't Start

**Error:** Container keeps restarting or shows "unhealthy"

**Solution:**
1. Check logs:
   ```bash
   docker-compose logs <service-name>
   ```
2. Check if dependencies are ready:
   ```bash
   docker-compose ps
   ```
3. Restart the specific service:
   ```bash
   docker-compose restart <service-name>
   ```

### Issue: "Connection Refused" When Testing

**Error:** `curl: (7) Failed to connect to localhost`

**Solution:**
1. Verify services are running: `docker-compose ps`
2. Check if Nginx is up: `docker-compose logs nginx`
3. Try direct API access: 
   - PowerShell: `Invoke-RestMethod -Uri http://localhost:3001/health`
   - Bash: `curl http://localhost:3001/health`

### Issue: JSON Parse Error on Purchase Request

**Error:** `{"error":"INTERNAL_ERROR","message":"An unexpected error occurred"}` or `SyntaxError: Unexpected token`

**What this means:**
The JSON body is malformed. On Windows, PowerShell's `curl` alias doesn't handle JSON properly.

**Solution:**
**Use PowerShell's `Invoke-RestMethod` instead:**
```powershell
Invoke-RestMethod -Uri http://localhost/api/v1/flash/purchase -Method POST -ContentType "application/json" -Body '{"userId":"123","skuId":"1","quantity":1,"idempotencyKey":"test-1"}'
```

**Or use `curl.exe` with properly escaped quotes:**
```powershell
curl.exe -X POST http://localhost/api/v1/flash/purchase -H "Content-Type: application/json" -d "{\"userId\":\"123\",\"skuId\":\"1\",\"quantity\":1,\"idempotencyKey\":\"test-1\"}"
```

**Why this happens:**
- PowerShell's `curl` is an alias for `Invoke-WebRequest`, which has different syntax
- Single quotes in bash don't work the same in PowerShell
- JSON needs proper escaping when using `curl.exe`

### Issue: Kafka Container Fails to Start

**Error:** `Container ticket-craze-kafka-1 Error` or `KeeperErrorCode = NodeExists`

**What this means:**
Kafka is trying to register itself in Zookeeper, but a node from a previous run already exists. This happens when containers are restarted without properly cleaning up Zookeeper state.

**Solution:**
1. Stop all containers:
   ```bash
   docker-compose down
   ```
2. Start Zookeeper first and wait for it to be ready:
   ```bash
   docker-compose up -d zookeeper
   # Wait 10-15 seconds for Zookeeper to fully start
   ```
3. Start all services:
   ```bash
   docker-compose up -d
   ```
4. Verify Kafka is healthy:
   ```bash
   docker-compose ps kafka
   # Should show "Healthy" status
   ```

**Alternative Solution (if above doesn't work):**
If the issue persists, you may need to clear Zookeeper data:
```bash
# Stop everything
docker-compose down -v

# This removes volumes, so you'll need to re-initialize:
docker-compose up -d
docker-compose exec api-1 npm run setup:kafka
docker-compose exec api-1 npm run setup:redis
```

### Issue: Kafka Topics Not Created

**Error:** `Topic creation errors` or topics missing

**Solution:**
1. Wait for Kafka to be fully ready (can take 30-60 seconds)
2. Check Kafka logs: `docker-compose logs kafka`
3. Verify Kafka is healthy: `docker-compose ps kafka`
4. Retry: `docker-compose exec api-1 npm run setup:kafka`

### Issue: Redis Inventory Not Initialized

**Error:** All purchases return "SOLD_OUT"

**Solution:**
1. Re-run inventory setup: `docker-compose exec api-1 npm run setup:redis`
2. Check Redis connection: `docker-compose logs redis`
3. Verify Redis is healthy: `docker-compose ps redis`

---

## Stopping the System

When you're done, you can stop all services:

```bash
# Stop all services (keeps containers)
docker-compose stop

# Stop and remove containers (keeps data volumes)
docker-compose down

# Stop and remove everything including data volumes (⚠️ deletes all data)
docker-compose down -v
```

**What each does:**
- `stop` - Stops containers but keeps them (faster to restart)
- `down` - Stops and removes containers (cleaner, but slower to restart)
- `down -v` - Also removes data volumes (⚠️ **WARNING:** This deletes all database and Redis data!)

---

## Restarting the System

If you've stopped the system and want to start it again:

```bash
# If you used 'stop'
docker-compose start

# If you used 'down'
docker-compose up -d
```

**Note:** You don't need to re-run Kafka setup or Redis initialization - that data persists in volumes.

---

## Quick Reference: Complete Startup Sequence

Here's the complete sequence in one place:

```bash
# 1. Start all services
docker-compose up -d --build

# 2. Wait for services to be healthy (30-60 seconds)
docker-compose ps

# 3. Setup Kafka topics
docker-compose exec api-1 npm run setup:kafka

# 4. Initialize Redis inventory
docker-compose exec api-1 npm run setup:redis

# 5. Test health
curl http://localhost:3001/health

# 6. Test purchase
# Windows (PowerShell):
Invoke-RestMethod -Uri http://localhost/api/v1/flash/purchase -Method POST -ContentType "application/json" -Body '{"userId":"123","skuId":"1","quantity":1,"idempotencyKey":"test-1"}'

# Mac/Linux:
curl -X POST http://localhost/api/v1/flash/purchase -H "Content-Type: application/json" -d "{\"userId\":\"123\",\"skuId\":\"1\",\"quantity\":1,\"idempotencyKey\":\"test-1\"}"

# 7. (Optional) Run stress tests
# Quick test (1 minute):
k6 run tests/load/quick-stress.js

# Heavy load test (9 minutes):
k6 run tests/load/heavy-load.js
```

---

## Next Steps

Now that your system is running, you can:

1. **Test the system:**
   - Make purchase requests to verify everything works
   - Check orders in MySQL: `docker-compose exec mysql mysql -uflashuser -pflashpass flash_sale -e "SELECT * FROM orders LIMIT 10;"`
   - View inventory in Redis: `docker-compose exec redis redis-cli GET inv:sku:1`

2. **Run stress tests:**
   - See [Load Testing Guide](../tests/load/README.md) for k6 stress testing instructions
   - Test the system under high concurrency (1000+ users)
   - Verify zero overselling and performance metrics

3. **Monitor the system:**
   - Use Grafana dashboards to see metrics (http://localhost:3000)
   - Check Kafka UI to see message flow (http://localhost:8080)
   - Watch logs: `docker-compose logs -f api-1`

4. **Explore the code:**
   - Check `src/routes/flash.js` for the purchase endpoint
   - Look at `src/workers/order-worker.js` for order processing
   - Review `scripts/decr_inventory.lua` for atomic inventory operations

5. **Learn more:**
   - Read the [system design documentation](../README.md#learn-more) in README.md
   - Learn about Redis, Kafka, and eventual consistency

---

## Summary

You've successfully started the Ticket Craze system! Here's what we did:

1. ✅ Started all Docker containers (Redis, MySQL, Kafka, API servers, etc.)
2. ✅ Created Kafka topics for message routing
3. ✅ Initialized Redis inventory with stock quantities
4. ✅ Verified the system is working with health and purchase tests

The system is now ready to handle flash sale traffic! 🎉

## Additional Resources

- **Load Testing**: See [tests/load/README.md](../tests/load/README.md) for stress testing with k6
- **System Design**: Check [README.md](../README.md#learn-more) for architecture documentation
- **Performance Results**: View stress test results in the main [README.md](../README.md#stress-testing-results)

