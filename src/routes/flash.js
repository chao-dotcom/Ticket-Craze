// File: src/routes/flash.js
const express = require('express');
const { createClient } = require('redis');
const { Kafka } = require('kafkajs');
const Snowflake = require('../utils/snowflake');
const { loadLuaScripts } = require('../utils/redis-scripts');
const { metrics } = require('../utils/metrics');

const router = express.Router();

// Initialize clients
const redisClient = createClient({ 
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: { 
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});

const kafka = new Kafka({
  clientId: 'flash-sale-api',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const producer = kafka.producer({
  allowAutoTopicCreation: false,
  transactionTimeout: 30000
});

let luaScripts = {};
let isInitialized = false;

// Startup initialization
async function initializeFlashSale() {
  if (isInitialized) return;
  
  try {
    // Check if Redis is already connected before connecting
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    // Connect Kafka producer (kafkajs handles multiple connect calls gracefully)
    try {
      await producer.connect();
    } catch (error) {
      // Ignore "already connected" errors
      if (!error.message || !error.message.includes('already')) {
        throw error;
      }
    }
    luaScripts = await loadLuaScripts(redisClient);
    isInitialized = true;
    console.log('Flash sale module initialized');
  } catch (error) {
    console.error('Failed to initialize flash sale module:', error);
    throw error;
  }
}

// Main purchase endpoint
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

    // 2. Idempotency check
    const idemKey = `idem:${idempotencyKey || `${userId}:${skuId}`}`;
    const isNew = await redisClient.set(idemKey, '1', {
      NX: true,
      EX: 300  // 5 minutes
    });

    if (!isNew) {
      metrics.purchaseAttempts.inc({ status: 'duplicate', reason: 'idempotency' });
      return res.status(409).json({ 
        error: 'DUPLICATE_REQUEST',
        message: 'This request has already been processed' 
      });
    }

    // 3. Rate limiting
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
      metrics.purchaseAttempts.inc({ status: 'rate_limited', reason: 'token_bucket' });
      return res.status(429).json({ 
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again in a moment.',
        retryAfter: 2
      });
    }

    // 4. Atomic inventory check and decrement
    const invKey = `inv:sku:${skuId}`;
    const resvPrefix = `resv:sku:${skuId}`;
    const reservationId = Snowflake.nextId();
    const ttl = 300;  // 5 minutes to complete purchase

    const inventoryStart = Date.now();
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
    metrics.redisOperationDuration.observe(
      { operation: 'decr_inventory' },
      (Date.now() - inventoryStart) / 1000
    );

    // Check result
    if (!inventoryResult || inventoryResult[0] !== 1) {
      const currentStock = inventoryResult ? inventoryResult[1] : 0;
      metrics.purchaseAttempts.inc({ status: 'sold_out', reason: 'insufficient_stock' });
      metrics.inventoryOperations.inc({ operation: 'decrement', result: 'failed' });
      return res.status(410).json({ 
        error: 'SOLD_OUT',
        message: 'This item is currently sold out',
        remainingStock: currentStock
      });
    }

    metrics.inventoryOperations.inc({ operation: 'decrement', result: 'success' });

    // 5. Generate order ID and produce Kafka event
    const orderId = Snowflake.nextId();
    const event = {
      reservationId,
      orderId,
      userId,
      skuId,
      quantity,
      status: 'reserved',
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttl * 1000)
    };

    const kafkaStart = Date.now();
    await producer.send({
      topic: 'reservations',
      messages: [{
        key: reservationId,
        value: JSON.stringify(event),
        headers: {
          'trace-id': req.headers['x-trace-id'] || `trace-${Date.now()}`
        }
      }]
    });
    metrics.kafkaProduceLatency.observe(
      { topic: 'reservations' },
      (Date.now() - kafkaStart) / 1000
    );

    // 6. Success response
    const duration = Date.now() - startTime;
    metrics.purchaseAttempts.inc({ status: 'success', reason: 'completed' });
    metrics.httpRequestDuration.observe(
      { method: 'POST', route: '/purchase', status_code: 200 },
      duration / 1000
    );

    res.json({
      success: true,
      reservationId,
      orderId,
      expiresAt: event.expiresAt,
      message: 'Reservation confirmed. Complete payment within 5 minutes.',
      processingTimeMs: duration
    });

  } catch (error) {
    console.error('Purchase error:', error);
    metrics.purchaseAttempts.inc({ status: 'error', reason: error.message });
    metrics.httpRequestDuration.observe(
      { method: 'POST', route: '/purchase', status_code: 500 },
      (Date.now() - startTime) / 1000
    );
    res.status(500).json({ 
      error: 'INTERNAL_ERROR',
      message: 'An error occurred. Please try again.' 
    });
  }
});

module.exports = { router, initializeFlashSale };

