const { createClient } = require('redis');
import mysql from 'mysql2/promise';

class ReservationCleanup {
  redisClient: any;
  dbPool: any;

  constructor() {
    this.redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    this.dbPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'flashuser',
      password: process.env.MYSQL_PASSWORD || 'flashpass',
      database: process.env.MYSQL_DATABASE || 'flash_sale'
    });
  }

  async start() {
    await this.redisClient.connect();
    setInterval(() => this.cleanup(), 60000);
    console.log('Reservation cleanup job started');
  }

  async cleanup() {
    try {
      const [expiredOrders] = await this.dbPool.query(`
        SELECT o.id, oi.sku_id, oi.quantity
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status = 'PENDING' 
          AND o.expires_at < NOW()
        LIMIT 100
      `);

      for (const order of expiredOrders) {
        await this.releaseReservation(order);
      }

      if (expiredOrders.length > 0) {
        console.log(`Cleaned up ${expiredOrders.length} expired reservations`);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  async releaseReservation(order: any) {
    const connection = await this.dbPool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE orders SET status = ? WHERE id = ?', ['EXPIRED', order.id]);
      const invKey = `inv:sku:${order.sku_id}`;
      await this.redisClient.incrBy(invKey, order.quantity);
      await connection.query(`INSERT INTO inventory_audit (sku_id, change_qty, reason, ref_id) VALUES (?, ?, ?, ?)`, [order.sku_id, order.quantity, 'RESERVATION_EXPIRED', order.id]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

if (require.main === module) {
  const cleanup = new ReservationCleanup();
  cleanup.start().catch(console.error);
}

export default ReservationCleanup;
(module as any).exports = ReservationCleanup;
