// File: scripts/reset-inventory-redis.js
// Reset Redis inventory to initial values
const { createClient } = require('redis');

async function resetInventory() {
  const redisClient = createClient({ 
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  try {
    await redisClient.connect();
    console.log('Connected to Redis');

    // Reset inventory to initial values
    const sampleSkus = [
      { id: 1, quantity: 1000 },
      { id: 2, quantity: 500 },
      { id: 3, quantity: 2000 },
      { id: 4, quantity: 750 },
      { id: 5, quantity: 100 }
    ];

    for (const sku of sampleSkus) {
      await redisClient.set(`inv:sku:${sku.id}`, sku.quantity);
      console.log(`Reset inventory for SKU ${sku.id}: ${sku.quantity}`);
    }

    // Clear reservations (optional, for clean state)
    const reservationKeys = await redisClient.keys('resv:sku:*');
    if (reservationKeys.length > 0) {
      await redisClient.del(reservationKeys);
      console.log(`Cleared ${reservationKeys.length} reservation keys`);
    }

    // Clear idempotency keys (optional)
    const idemKeys = await redisClient.keys('idem:*');
    if (idemKeys.length > 0) {
      await redisClient.del(idemKeys);
      console.log(`Cleared ${idemKeys.length} idempotency keys`);
    }

    // Clear rate limit buckets (optional)
    const bucketKeys = await redisClient.keys('bucket:*');
    if (bucketKeys.length > 0) {
      await redisClient.del(bucketKeys);
      console.log(`Cleared ${bucketKeys.length} rate limit buckets`);
    }

    console.log('Redis inventory reset complete');
  } catch (error) {
    console.error('Error resetting inventory:', error);
    throw error;
  } finally {
    await redisClient.quit();
  }
}

if (require.main === module) {
  resetInventory().catch(console.error);
}

module.exports = { resetInventory };

