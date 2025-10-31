// File: src/workers/order-worker.js
const { Kafka } = require('kafkajs');
const mysql = require('mysql2/promise');
const { createClient } = require('redis');

class OrderWorker {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'order-worker',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
    });
    
    this.consumer = this.kafka.consumer({ 
      groupId: 'order-processing-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    this.producer = this.kafka.producer();  // For DLQ
    
    this.dbPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'flashuser',
      password: process.env.MYSQL_PASSWORD || 'flashpass',
      database: process.env.MYSQL_DATABASE || 'flash_sale',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    this.redisClient = createClient({ 
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
  }

  async start() {
    try {
      await this.redisClient.connect();
      await this.consumer.connect();
      await this.producer.connect();

      await this.consumer.subscribe({ 
        topic: 'reservations',
        fromBeginning: false 
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.processReservation(message);
        }
      });

      console.log('Order worker started');
    } catch (error) {
      console.error('Failed to start order worker:', error);
      throw error;
    }
  }

  async processReservation(message) {
    const traceId = message.headers?.['trace-id']?.toString();
    
    try {
      const event = JSON.parse(message.value.toString());
      console.log(`Processing reservation ${event.reservationId}`, { traceId });

      // Check if already processed (idempotency)
      const connection = await this.dbPool.getConnection();
      
      try {
        await connection.beginTransaction();

        // Check for existing order
        const [existing] = await connection.query(
          'SELECT id FROM orders WHERE id = ? FOR UPDATE',
          [event.orderId]
        );

        if (existing.length > 0) {
          console.log(`Order ${event.orderId} already exists, skipping`);
          await connection.rollback();
          return;
        }

        // Insert order
        await connection.query(
          `INSERT INTO orders (id, user_id, status, total, created_at, expires_at)
           VALUES (?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))`,
          [
            event.orderId,
            event.userId,
            'PENDING',
            0,  // Calculate from SKU price lookup
            Math.floor(event.createdAt / 1000),
            Math.floor(event.expiresAt / 1000)
          ]
        );

        // Insert order items
        await connection.query(
          `INSERT INTO order_items (order_id, sku_id, quantity, price)
           VALUES (?, ?, ?, ?)`,
          [event.orderId, event.skuId, event.quantity, 0]  // Fetch price from SKU
        );

        // Audit log
        await connection.query(
          `INSERT INTO inventory_audit (sku_id, change_qty, reason, ref_id)
           VALUES (?, ?, ?, ?)`,
          [event.skuId, -event.quantity, 'RESERVATION', event.reservationId]
        );

        await connection.commit();
        console.log(`Order ${event.orderId} created successfully`);

        // Produce to orders topic for payment processing
        await this.producer.send({
          topic: 'orders',
          messages: [{
            key: event.orderId,
            value: JSON.stringify({
              ...event,
              status: 'pending_payment'
            })
          }]
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      console.error('Failed to process reservation:', error);
      
      // Send to dead letter queue after retries
      await this.sendToDLQ(message, error);
    }
  }

  async sendToDLQ(message, error) {
    try {
      await this.producer.send({
        topic: 'order-dead-letter',
        messages: [{
          key: message.key,
          value: message.value,
          headers: {
            ...message.headers,
            'error': error.message,
            'failed-at': Date.now().toString()
          }
        }]
      });
    } catch (dlqError) {
      console.error('Failed to send to DLQ:', dlqError);
    }
  }

  async stop() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
    await this.redisClient.quit();
    await this.dbPool.end();
  }
}

// Start worker if running directly
if (require.main === module) {
  const worker = new OrderWorker();
  worker.start().catch(console.error);

  process.on('SIGTERM', () => worker.stop());
  process.on('SIGINT', () => worker.stop());
}

module.exports = OrderWorker;

