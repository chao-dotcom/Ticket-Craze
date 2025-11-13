// File: src/routes/flash-naive.js
// MOST NAIVE IMPLEMENTATION - MySQL + Node.js only (NO Redis, NO Kafka)
// This demonstrates what happens with the simplest possible approach
// DO NOT USE IN PRODUCTION - This will oversell and have race conditions!

const express = require('express');
const mysql = require('mysql2/promise');

const router = express.Router();

// Simple database connection (no connection pooling)
// ❌ PROBLEM: Single connection, will fail under load
// ❌ PROBLEM: No connection pooling - creates bottleneck
let dbConnection = null;

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

// Initialize inventory table if it doesn't exist
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
  
  // Initialize inventory if empty
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

// NAIVE purchase endpoint - demonstrates problems
router.post('/purchase', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Ensure inventory table exists
    await ensureInventoryTable();
    
    const { userId, skuId, quantity = 1 } = req.body;
    
    // Basic validation
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

    const connection = await getDbConnection();

    // ❌ PROBLEM 1: Non-atomic check-then-act (CLASSIC RACE CONDITION)
    // Step 1: Read current stock from MySQL
    // Step 2: Check if stock >= quantity
    // Step 3: Update stock in MySQL
    // 
    // RACE CONDITION SCENARIO:
    // - Request A reads stock = 1
    // - Request B reads stock = 1 (before A updates)
    // - Request A checks: 1 >= 1 (true), updates to 0
    // - Request B checks: 1 >= 1 (true), updates to -1
    // Result: OVERSOLD! Stock goes negative, 2 items sold but only 1 available
    const [stockRows] = await connection.query(
      'SELECT stock FROM inventory WHERE sku_id = ?',
      [skuId]
    );

    if (stockRows.length === 0) {
      return res.status(404).json({ 
        error: 'SKU_NOT_FOUND',
        message: 'Product not found' 
      });
    }

    const currentStock = stockRows[0].stock;

    // ❌ PROBLEM 2: Check happens BEFORE update (not atomic)
    if (currentStock < quantity) {
      return res.status(410).json({ 
        error: 'SOLD_OUT',
        message: 'This item is currently sold out',
        remainingStock: currentStock
      });
    }

    // ❌ PROBLEM 3: Update happens AFTER check (race condition window)
    // Between the SELECT and UPDATE, another request can interfere
    const newStock = currentStock - quantity;
    await connection.query(
      'UPDATE inventory SET stock = ? WHERE sku_id = ?',
      [newStock, skuId]
    );

    // ❌ PROBLEM 4: Synchronous database write (SLOW, blocks request)
    // User must wait for database write to complete
    // Under load, database becomes bottleneck (200-500ms per request)
    
    // ❌ PROBLEM 5: No idempotency - duplicate requests create duplicate orders
    // User clicks "Buy" twice → 2 orders created
    // Network retry → duplicate order
    const orderId = Date.now() + Math.floor(Math.random() * 1000); // Simple ID (collisions possible!)
    const reservationId = orderId + 1;

    // ❌ PROBLEM 6: No transaction - if second insert fails, order is incomplete
    // ❌ PROBLEM 7: Blocks request - user waits for slow database write
    await connection.query(
      `INSERT INTO orders (id, user_id, status, total, created_at) 
       VALUES (?, ?, 'PENDING', 0, NOW())`,
      [orderId, userId]
    );

    await connection.query(
      `INSERT INTO order_items (order_id, sku_id, quantity, price) 
       VALUES (?, ?, ?, 0)`,
      [orderId, skuId, quantity]
    );

    // ❌ PROBLEM 8: No async processing - everything happens synchronously
    // If DB is slow (200-500ms), user waits
    // If DB fails, order is lost (no retry mechanism)
    // No Kafka, no workers, no resilience

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      reservationId: reservationId.toString(),
      orderId: orderId.toString(),
      message: 'Purchase completed (naive MySQL-only implementation)',
      warning: '⚠️ This implementation has race conditions and will oversell!',
      remainingStock: newStock, // May be negative due to race conditions!
      processingTimeMs: duration
    });

  } catch (error) {
    console.error('Naive purchase error:', error);
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
    await ensureInventoryTable();
    const connection = await getDbConnection();
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM inventory');
    
    res.json({ 
      status: 'ok',
      implementation: 'naive-mysql-only',
      warning: '⚠️ This is a naive MySQL-only implementation for comparison only',
      database: 'connected',
      inventory_items: rows[0].count
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      implementation: 'naive-mysql-only',
      error: error.message
    });
  }
});

// Get inventory status (for debugging)
router.get('/inventory', async (req, res) => {
  try {
    await ensureInventoryTable();
    const connection = await getDbConnection();
    const [rows] = await connection.query('SELECT * FROM inventory ORDER BY sku_id');
    
    res.json({
      inventory: rows,
      warning: '⚠️ This is naive implementation - stock may be negative due to race conditions!'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

