import express, { Request, Response } from 'express';

const mysql = require('mysql2/promise');
const Snowflake: any = require('../utils/snowflake');
const { createClient } = require('redis');
const { loadLuaScripts } = require('../utils/redis-scripts');

const router = express.Router();

let dbConnection: any = null;

async function getDbConnection() {
  if (!dbConnection) {
    try {
      dbConnection = await mysql.createConnection({
        host: process.env.MYSQL_HOST || 'localhost',
        port: process.env.MYSQL_PORT || 3307,
        user: process.env.MYSQL_USER || 'flashuser',
        password: process.env.MYSQL_PASSWORD || 'flashpass',
        database: process.env.MYSQL_DATABASE || 'flash_sale'
      });
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw error;
    }
  }
  return dbConnection;
}

async function ensureInventoryTable() {
  const connection = await getDbConnection();
  await connection.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      sku_id INT PRIMARY KEY,
      stock INT NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_stock (stock)
    ) ENGINE=InnoDB
  `);

  const [rows] = await connection.query('SELECT COUNT(*) as count FROM inventory');
  if (rows[0].count === 0) {
    const initialInventory = [
      { sku_id: 1, stock: 1000 },
      { sku_id: 2, stock: 500 },
      { sku_id: 3, stock: 2000 },
      { sku_id: 4, stock: 750 },
      { sku_id: 5, stock: 100 }
    ];
    for (const item of initialInventory) {
      await connection.query(
        'INSERT INTO inventory (sku_id, stock) VALUES (?, ?)',
        [item.sku_id, item.stock]
      );
    }
    console.log('Initialized inventory table');
  }
}

const redisClient: any = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: { reconnectStrategy: (retries: number) => Math.min(retries * 50, 500) }
});

router.post('/purchase', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    await ensureInventoryTable();
    const { userId, skuId, quantity = 1 } = req.body as any;

    if (!userId || !skuId) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'userId and skuId are required' });
    }

    if (quantity < 1 || quantity > 10) {
      return res.status(400).json({ error: 'INVALID_QUANTITY', message: 'Quantity must be between 1 and 10' });
    }

    const connection = await getDbConnection();

    const [stockRows] = await connection.query('SELECT stock FROM inventory WHERE sku_id = ?', [skuId]);
    if (stockRows.length === 0) {
      return res.status(404).json({ error: 'SKU_NOT_FOUND', message: 'Product not found' });
    }

    const currentStock = stockRows[0].stock;
    if (currentStock < quantity) {
      return res.status(410).json({ error: 'SOLD_OUT', message: 'This item is currently sold out', remainingStock: currentStock });
    }

    const newStock = currentStock - quantity;
    await connection.query('UPDATE inventory SET stock = ? WHERE sku_id = ?', [newStock, skuId]);

    const orderId = Date.now() + Math.floor(Math.random() * 1000);
    const reservationId = orderId + 1;

    await connection.query(
      `INSERT INTO orders (id, user_id, status, total, created_at) VALUES (?, ?, 'PENDING', 0, NOW())`,
      [orderId, userId]
    );

    await connection.query(`INSERT INTO order_items (order_id, sku_id, quantity, price) VALUES (?, ?, ?, 0)`, [orderId, skuId, quantity]);

    const duration = Date.now() - startTime;
    res.json({
      success: true,
      reservationId: reservationId.toString(),
      orderId: orderId.toString(),
      message: 'Purchase completed (naive MySQL-only implementation)',
      warning: '⚠️ This implementation has race conditions and will oversell!',
      remainingStock: newStock,
      processingTimeMs: duration
    });
  } catch (error: any) {
    console.error('Naive purchase error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An error occurred. Please try again.', details: error.message });
  }
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    await ensureInventoryTable();
    const connection = await getDbConnection();
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM inventory');
    res.json({ status: 'ok', implementation: 'naive-mysql-only', warning: '⚠️ This is a naive MySQL-only implementation for comparison only', database: 'connected', inventory_items: rows[0].count });
  } catch (error: any) {
    res.status(500).json({ status: 'error', implementation: 'naive-mysql-only', error: error.message });
  }
});

router.get('/inventory', async (req: Request, res: Response) => {
  try {
    await ensureInventoryTable();
    const connection = await getDbConnection();
    const [rows] = await connection.query('SELECT * FROM inventory ORDER BY sku_id');
    res.json({ inventory: rows, warning: '⚠️ This is naive implementation - stock may be negative due to race conditions!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
export default router;
