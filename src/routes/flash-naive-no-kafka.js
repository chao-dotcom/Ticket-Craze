// File: src/routes/flash-naive-no-kafka.js
// NAIVE IMPLEMENTATION - Redis but NO Kafka
// This demonstrates what happens WITH Redis (atomic ops) but WITHOUT Kafka (synchronous DB writes)
// DO NOT USE IN PRODUCTION - Synchronous DB writes will bottleneck the system!

const express = require('express');
const { createClient } = require('redis');
const mysql = require('mysql2/promise');
const Snowflake = require('../utils/snowflake');
const { loadLuaScripts } = require('../utils/redis-scripts');

const router = express.Router();

// Redis client (same as optimized)
const redisClient = createClient({ 
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: { 
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});

// MySQL connection pool (for synchronous writes)
// ⚠️ PROBLEM: Even with connection pooling, synchronous writes are slow
let dbPool = null;

function getDbPool() {
  if (!dbPool) {
    dbPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3307,
      user: process.env.MYSQL_USER || 'flashuser',
      password: process.env.MYSQL_PASSWORD || 'flashpass',
      database: process.env.MYSQL_DATABASE || 'flash_sale',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return dbPool;
}

let luaScripts = {};
let isInitialized = false;

// Startup initialization
async function initializeFlashSale() {
  if (isInitialized) return;
  
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    luaScripts = await loadLuaScripts(redisClient);
    isInitialized = true;
    console.log('Flash sale module initialized (Redis only, no Kafka)');
  } catch (error) {
    console.error('Failed to initialize flash sale module:', error);
    throw error;
  }
}

// Purchase endpoint - Redis for inventory, but synchronous MySQL writes
router.post('/purchase', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Wait for initialization if needed
    if (!isInitialized) {
      await initializeFlashSale();
    }

    // 1. Validate input
    const { userId, skuId, quantity = 1, idempotencyKey } = req.body;
    
    if (!userId || !skuId) {
      return res.status(400).json({ 
        error: 'INVALID_REQUEST',
        message: 'userId and skuId are required' 
      });
    }

    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({ 
        error: 'INVALID_QUANTITY',
        message: 'Quantity must be between 1 and 10' 
      });
    }

    // 2. Idempotency check (Redis - fast)
    const idemKey = `idem:${idempotencyKey || `${userId}:${skuId}`}`;
    const isNew = await redisClient.set(idemKey, '1', {
      NX: true,
      EX: 300  // 5 minutes
    });

    if (!isNew) {
      return res.status(409).json({ 
        error: 'DUPLICATE_REQUEST',
        message: 'This request has already been processed' 
      });
    }

    // 3. Rate limiting (Redis - fast)
    const rateLimitKey = `bucket:user:${userId}`;
    const rateLimitResult = await redisClient.evalSha(
      luaScripts.tokenBucket,
      {
        keys: [rateLimitKey],
        arguments: ['20', '5', String(Math.floor(Date.now() / 1000)), '1']
        // capacity=20, rate=5/sec, current_time, tokens_needed=1
      }
    );

    if (rateLimitResult === 0) {
      return res.status(429).json({ 
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again in a moment.',
        retryAfter: 2
      });
    }

    // 4. Atomic inventory check and decrement (Redis - fast, atomic)
    // ✅ This part is GOOD - Redis Lua script prevents race conditions
    const invKey = `inv:sku:${skuId}`;
    const resvPrefix = `resv:sku:${skuId}`;
    const reservationId = Snowflake.nextId();
    const ttl = 300;  // 5 minutes to complete purchase

    const inventoryResult = await redisClient.evalSha(
      luaScripts.decrInventory,
      {
        keys: [invKey],
        arguments: [
          String(quantity),
          resvPrefix,
          reservationId,
          String(ttl),
          String(Math.floor(Date.now() / 1000))  // Pass timestamp to avoid non-deterministic TIME call in Lua
        ]
      }
    );

    // Check result
    if (!inventoryResult || inventoryResult[0] !== 1) {
      const currentStock = inventoryResult ? inventoryResult[1] : 0;
      return res.status(410).json({ 
        error: 'SOLD_OUT',
        message: 'This item is currently sold out',
        remainingStock: currentStock
      });
    }

    // 5. ⚠️ PROBLEM: Synchronous MySQL writes (SLOW, blocks request)
    // In optimized version, this would be sent to Kafka and processed async
    // Here, we wait for database writes to complete (200-500ms)
    const orderId = Snowflake.nextId();
    const pool = getDbPool();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Check for existing order (idempotency at DB level)
      const [existing] = await connection.query(
        'SELECT id FROM orders WHERE id = ? FOR UPDATE',
        [orderId]
      );

      if (existing.length > 0) {
        await connection.rollback();
        return res.status(409).json({ 
          error: 'DUPLICATE_REQUEST',
          message: 'This request has already been processed' 
        });
      }

      // Insert order (SLOW - 100-200ms)
      // Convert userId to number (MySQL expects BIGINT)
      const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      await connection.query(
        `INSERT INTO orders (id, user_id, status, total, created_at, expires_at)
         VALUES (?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))`,
        [
          orderId,
          userIdNum,
          'PENDING',
          0,  // Calculate from SKU price lookup
          Math.floor(Date.now() / 1000),
          Math.floor((Date.now() + ttl * 1000) / 1000)
        ]
      );

      // Insert order items (SLOW - 50-100ms)
      await connection.query(
        `INSERT INTO order_items (order_id, sku_id, quantity, price)
         VALUES (?, ?, ?, ?)`,
        [orderId, skuId, quantity, 0]  // Fetch price from SKU
      );

      // Audit log (SLOW - 50-100ms)
      await connection.query(
        `INSERT INTO inventory_audit (sku_id, change_qty, reason, ref_id)
         VALUES (?, ?, ?, ?)`,
        [skuId, -quantity, 'RESERVATION', reservationId]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // 6. Success response
    // ⚠️ PROBLEM: User waited 200-500ms for all DB writes to complete
    // In optimized version, response would be <200ms (just Redis + Kafka publish)
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      reservationId,
      orderId,
      expiresAt: Date.now() + (ttl * 1000),
      message: 'Purchase completed (Redis but no Kafka - synchronous DB writes)',
      warning: '⚠️ This implementation uses Redis for inventory but waits for MySQL writes',
      processingTimeMs: duration
    });

  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ 
      error: 'INTERNAL_ERROR',
      message: 'An error occurred. Please try again.',
      details: error.message
    });
  }
});

// Health check
router.get('/health', async (req, res) => {
  try {
    if (!isInitialized) {
      await initializeFlashSale();
    }
    
    const pool = getDbPool();
    await pool.query('SELECT 1');
    
    res.json({ 
      status: 'ok',
      implementation: 'naive-redis-no-kafka',
      warning: '⚠️ This implementation uses Redis but synchronous MySQL writes',
      redis: redisClient.isOpen ? 'connected' : 'disconnected',
      mysql: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      implementation: 'naive-redis-no-kafka',
      error: error.message
    });
  }
});

module.exports = router;

