// File: scripts/reset-inventory-mysql.js
// Reset MySQL inventory to initial values
const mysql = require('mysql2/promise');

async function resetInventory() {
  const host = process.env.MYSQL_HOST || 'localhost';
  const port = process.env.MYSQL_PORT || 3307;
  const user = process.env.MYSQL_USER || 'flashuser';
  const password = process.env.MYSQL_PASSWORD || 'flashpass';
  const database = process.env.MYSQL_DATABASE || 'flash_sale';

  console.log(`Connecting to MySQL at ${host}:${port}...`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host: host,
      port: port,
      user: user,
      password: password,
      database: database
    });
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('');
      console.error('❌ ERROR: Cannot connect to MySQL');
      console.error('');
      console.error('MySQL is not running. Please start it:');
      console.error('   docker-compose up -d mysql');
      console.error('');
      console.error(`Attempted connection: ${host}:${port}`);
      console.error('');
      process.exit(1);
    }
    throw error;
  }

  try {
    console.log('✅ Connected to MySQL');

    // Ensure inventory table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        sku_id INT PRIMARY KEY,
        stock INT NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_stock (stock)
      ) ENGINE=InnoDB
    `);

    // Reset inventory to initial values
    const sampleSkus = [
      { sku_id: 1, stock: 1000 },
      { sku_id: 2, stock: 500 },
      { sku_id: 3, stock: 2000 },
      { sku_id: 4, stock: 750 },
      { sku_id: 5, stock: 100 }
    ];

    // Use INSERT ... ON DUPLICATE KEY UPDATE to reset
    for (const sku of sampleSkus) {
      await connection.query(
        `INSERT INTO inventory (sku_id, stock) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE stock = ?`,
        [sku.sku_id, sku.stock, sku.stock]
      );
      console.log(`Reset inventory for SKU ${sku.sku_id}: ${sku.stock}`);
    }

    console.log('✅ MySQL inventory reset complete');
  } catch (error) {
    console.error('');
    console.error('❌ Error resetting inventory:', error.message);
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('');
      console.error('Database does not exist. Make sure MySQL is initialized.');
      console.error('Run: docker-compose up -d mysql');
    }
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  resetInventory().catch(console.error);
}

module.exports = { resetInventory };

