import express, { Request, Response } from 'express';

const { createClient } = require('redis');
const mysql = require('mysql2/promise');
const Snowflake: any = require('../utils/snowflake');
const { loadLuaScripts } = require('../utils/redis-scripts');

const router = express.Router();

const redisClient: any = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: { reconnectStrategy: (retries: number) => Math.min(retries * 50, 500) }
});

let dbPool: any = null;

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

let luaScripts: any = {};
let isInitialized = false;

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

router.post('/purchase', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    if (!isInitialized) {
      await initializeFlashSale();
    }

    const { userId, skuId, quantity = 1, idempotencyKey } = req.body as any;
    if (!userId || !skuId) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'userId and skuId are required' });
    }

    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({ error: 'INVALID_QUANTITY', message: 'Quantity must be between 1 and 10' });
    }

    const idemKey = `idem:${idempotencyKey || `${userId}:${skuId}`}`;
    const isNew = await redisClient.set(idemKey, '1', { NX: true, EX: 300 });
    if (!isNew) {
      return res.status(409).json({ error: 'DUPLICATE_REQUEST', message: 'This request has already been processed' });
    }

    const rateLimitKey = `bucket:user:${userId}`;
    const rateLimitResult = await redisClient.evalSha(luaScripts.tokenBucket, {
      keys: [rateLimitKey],
      arguments: ['20', '5', String(Math.floor(Date.now() / 1000)), '1']
    });
    if (rateLimitResult === 0) {
      return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again in a moment.', retryAfter: 2 });
    }

    const invKey = `inv:sku:${skuId}`;
    const resvPrefix = `resv:sku:${skuId}`;
    const reservationId = Snowflake.nextId();
    const ttl = 300;

    const inventoryResult = await redisClient.evalSha(luaScripts.decrInventory, {
      keys: [invKey],
      arguments: [String(quantity), resvPrefix, reservationId, String(ttl), String(Math.floor(Date.now() / 1000))]
    });

    if (!inventoryResult || inventoryResult[0] !== 1) {
      const currentStock = inventoryResult ? inventoryResult[1] : 0;
      return res.status(410).json({ error: 'SOLD_OUT', message: 'This item is currently sold out', remainingStock: currentStock });
    }

    const orderId = Snowflake.nextId();
    const pool = getDbPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query('SELECT id FROM orders WHERE id = ? FOR UPDATE', [orderId]);
      if (existing.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: 'DUPLICATE_REQUEST', message: 'This request has already been processed' });
      }

      const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      await connection.query(
        `INSERT INTO orders (id, user_id, status, total, created_at, expires_at) VALUES (?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))`,
        [orderId, userIdNum, 'PENDING', 0, Math.floor(Date.now() / 1000), Math.floor((Date.now() + ttl * 1000) / 1000)]
      );

      await connection.query(`INSERT INTO order_items (order_id, sku_id, quantity, price) VALUES (?, ?, ?, ?)`, [orderId, skuId, quantity, 0]);

      await connection.query(`INSERT INTO inventory_audit (sku_id, change_qty, reason, ref_id) VALUES (?, ?, ?, ?)`, [skuId, -quantity, 'RESERVATION', reservationId]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const duration = Date.now() - startTime;
    res.json({ success: true, reservationId, orderId, expiresAt: Date.now() + (ttl * 1000), message: 'Purchase completed (Redis but no Kafka - synchronous DB writes)', warning: '⚠️ This implementation uses Redis but waits for MySQL writes', processingTimeMs: duration });
  } catch (error: any) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An error occurred. Please try again.', details: error.message });
  }
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    if (!isInitialized) {
      await initializeFlashSale();
    }
    const pool = getDbPool();
    await pool.query('SELECT 1');
    res.json({ status: 'ok', implementation: 'naive-redis-no-kafka', warning: '⚠️ This implementation uses Redis but synchronous MySQL writes', redis: redisClient.isOpen ? 'connected' : 'disconnected', mysql: 'connected' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', implementation: 'naive-redis-no-kafka', error: error.message });
  }
});

module.exports = router;
export default router;
