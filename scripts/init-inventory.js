// File: scripts/init-inventory.js
const { createClient } = require('redis');
const { loadLuaScripts } = require('../src/utils/redis-scripts');

async function initInventory() {
  const redisClient = createClient({ 
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  try {
    await redisClient.connect();
    console.log('Connected to Redis');

    // Load Lua scripts
    await loadLuaScripts(redisClient);

    // Initialize sample inventory
    const sampleSkus = [
      { id: 1, quantity: 1000 },
      { id: 2, quantity: 500 },
      { id: 3, quantity: 2000 },
      { id: 4, quantity: 750 },
      { id: 5, quantity: 100 }
    ];

    for (const sku of sampleSkus) {
      await redisClient.set(`inv:sku:${sku.id}`, sku.quantity);
      console.log(`Initialized inventory for SKU ${sku.id}: ${sku.quantity}`);
    }

    console.log('Inventory initialization complete');
  } catch (error) {
    console.error('Error initializing inventory:', error);
    throw error;
  } finally {
    await redisClient.quit();
  }
}

if (require.main === module) {
  initInventory().catch(console.error);
}

module.exports = { initInventory };

