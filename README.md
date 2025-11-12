# Flash Sale Ticketing System

A production-grade, high-concurrency flash sale ticketing system capable of handling thousands of concurrent requests with zero overselling.

## Features

- **High Concurrency**: Handle 1000+ requests/second during flash sales
- **Zero Overselling**: Atomic inventory control using Redis Lua scripts
- **Fast Response**: Sub-200ms API response times
- **Event-Driven**: Resilient async processing with Kafka
- **Horizontally Scalable**: All components can scale independently


## Documentation Links

### Distributed System Notes for Beginners

I wrote these docus for beginners who want to understand how a flash-sale or high-concurrency ordering system works. The goal is to explain the "why" behind each component, not just throw architecture diagrams around.

We will walk through the system step by step, starting from the big picture, then moving into Redis, Kafka, and finally the idea of eventual consistency. Each document builds on the previous one, so you can follow along without feeling lost.

**Contents:**

1. **[Ticket-Craze: System Overview](https://hackmd.io/@chaodotcom/BJFrC6jyWg)**  
   Why systems need Redis and Kafka in the first place, and how these pieces fit together.

2. **[Ticket-Craze: Redis](https://hackmd.io/@chaodotcom/H1pwATjkWe)**  
   What role Redis plays in high-concurrency systems, how we use it, and a short introduction to Redis Cluster.

3. **[Ticket-Craze: Kafka](https://hackmd.io/@chaodotcom/BJCkJAikWl)**  
   Why Kafka is used, how it supports idempotency and distributed coordination. This chapter assumes basic Kafka familiarity. I recommend this [intro video](https://www.bilibili.com/video/BV1dpuXzSEZN/) for visualization.

4. **[Ticket-Craze: Eventual Consistency](https://hackmd.io/@chaodotcom/ry5ZJRi1Wx)**  
   Why we choose eventual consistency instead of strict immediate consistency. How to make an eventually consistent system traceable, repairable, and trustworthy.

## Architecture

### System Architecture Diagram

```mermaid
graph TB
    User[User/Browser] -->|HTTP POST| Nginx[Nginx Load Balancer]
    Nginx -->|Load Balance| API1[API Server 1]
    Nginx -->|Load Balance| API2[API Server 2]
    
    API1 -->|Check Inventory| Redis[(Redis)]
    API1 -->|Publish Event| Kafka[Kafka]
    API2 -->|Check Inventory| Redis
    API2 -->|Publish Event| Kafka
    
    Redis -->|Inventory Data| API1
    Redis -->|Inventory Data| API2
    
    Kafka -->|Consume| Worker[Order Worker]
    Worker -->|Insert Order| MySQL[(MySQL)]
    Worker -->|Publish| Kafka2[Kafka Orders Topic]
    
    Cleanup[Cleanup Job] -->|Query Expired| MySQL
    Cleanup -->|Return Inventory| Redis
    
    Prometheus[Prometheus] -->|Metrics| API1
    Prometheus -->|Metrics| API2
    Grafana[Grafana] -->|Query| Prometheus
    
    style Redis fill:#dc382d
    style MySQL fill:#00758f
    style Kafka fill:#231f20
    style Nginx fill:#009639
```

### Database Schema ERD

![Database Schema ERD](asset/schema_erd.png)

## Quick Start

### Prerequisites

- **Docker Desktop** (that's it! No need for Node.js locally)

**Container Setup (Recommended - Works on all platforms!):**
```bash
# Start all services
docker-compose up -d --build

# Setup Kafka topics
docker-compose exec api-1 npm run setup:kafka

# Initialize Redis inventory
docker-compose exec api-1 npm run setup:redis

# Test health
curl http://localhost:3001/health
```

All files are mounted, execution happens in containers. No local Node.js needed!

### Alternative: Local Development

- Docker and Docker Compose (for services)
- Node.js 18+ (for running the app locally)

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This starts:
- Redis (port 6379)
- MySQL (port 3306)
- Kafka + Zookeeper (ports 9092, 2181)
- Kafka UI (port 8080)
- API servers (ports 3001, 3002)
- Nginx (port 80)
- Prometheus (port 9090)
- Grafana (port 3000)

### 2. Setup Kafka Topics

```bash
npm install
npm run setup:kafka
```

### 3. Initialize Inventory

```bash
npm run setup:redis
```

### 4. Test the API

```bash
# Make a purchase request
curl -X POST http://localhost/api/v1/flash/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123",
    "skuId": "1",
    "quantity": 1,
    "idempotencyKey": "test-key-1"
  }'
```

## Development

### Running Locally (without Docker)

1. Start Redis, MySQL, and Kafka manually
2. Set environment variables (see `.env.example`)
3. Run `npm install`
4. Run `npm run dev`

### Environment Variables

```env
NODE_ENV=development
NODE_ID=1
PORT=3000
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
MYSQL_HOST=localhost
MYSQL_USER=flashuser
MYSQL_PASSWORD=flashpass
MYSQL_DATABASE=flash_sale
JWT_SECRET=change-me-in-production
```

## Testing & Validation

### Quick Validation

```bash
# 1. Start all services
docker-compose up -d --build

# 2. Setup (run once)
docker-compose exec api-1 npm run setup:kafka
docker-compose exec api-1 npm run setup:redis

# 3. Test health
curl http://localhost:3001/health

# 4. Test purchase
curl -X POST http://localhost/api/v1/flash/purchase -H "Content-Type: application/json" -d '{"userId":"123","skuId":"1","quantity":1,"idempotencyKey":"test-1"}'

# 5. Run tests
docker-compose exec api-1 npm test
docker-compose exec api-1 npm run test:integration

# 6. View logs
docker-compose logs -f api-1
```

### Automated Tests

```bash
# Run tests inside containers
docker-compose exec api-1 npm test
docker-compose exec api-1 npm run test:integration

# Run any command in container
docker-compose exec api-1 npm run setup:kafka
docker-compose exec api-1 node scripts/init-inventory.js

# Load tests (requires k6 installed locally)
npm run test:load
```

## Testing Results

### Load Testing Performance

The system has been stress tested under heavy load conditions using k6. Here are the key performance metrics:

**Heavy Load Test (1000 concurrent users, 9m 30s duration):**
- **Total Requests**: 612,839
- **Throughput**: ~1,135 requests/second
- **Average Response Time**: 204ms
- **Successful Purchases**: 4,350 (matches inventory capacity)
- **Zero Infrastructure Errors**: System handled load without failures
- **No Rate Limiting**: System processed traffic without throttling

**Key Highlights:**
- ✅ System successfully handled 1000+ concurrent users
- ✅ Maintained sub-200ms average response times under heavy load
- ✅ Zero overselling - exactly 4,350 successful orders (matching inventory)
- ✅ Proper handling of inventory depletion (410 responses when sold out)
- ✅ No technical errors - all failures were expected business logic (sold out)

For detailed k6 test results, interpretation guidelines, and information about testing scripts, see the [Load Testing Guide](tests/load/README.md).

## Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **Kafka UI**: http://localhost:8080

## API Endpoints

### POST /api/v1/flash/purchase

Purchase tickets during a flash sale.

**Request:**
```json
{
  "userId": "123",
  "skuId": "1",
  "quantity": 1,
  "idempotencyKey": "optional-unique-key"
}
```

**Response:**
```json
{
  "success": true,
  "reservationId": "1234567890",
  "orderId": "1234567891",
  "expiresAt": 1234567890000,
  "message": "Reservation confirmed. Complete payment within 5 minutes.",
  "processingTimeMs": 45
}
```

## Project Structure

```
.
├── src/
│   ├── routes/          # API routes
│   ├── workers/         # Kafka consumers
│   ├── jobs/            # Background jobs
│   ├── middleware/      # Express middleware
│   └── utils/           # Utilities (Snowflake, metrics, etc.)
├── scripts/             # Lua scripts and setup scripts
├── schema/              # Database migrations
├── nginx/               # Nginx configuration
├── monitoring/          # Prometheus configuration
└── docker-compose.yml   # Docker Compose setup
```

## Performance

- **API Response Time**: <200ms (p95)
- **Throughput**: 1000+ req/sec
- **Inventory Operations**: Atomic via Redis Lua scripts
- **Event Processing**: Async via Kafka

## License

MIT

