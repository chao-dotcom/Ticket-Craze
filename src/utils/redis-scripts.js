// File: src/utils/redis-scripts.js
const fs = require('fs').promises;
const path = require('path');

async function loadLuaScripts(redisClient) {
  const scriptsDir = path.join(__dirname, '../../scripts');
  const scripts = {};

  // Load inventory decrement script
  const decrScript = await fs.readFile(
    path.join(scriptsDir, 'decr_inventory.lua'), 
    'utf8'
  );
  scripts.decrInventory = await redisClient.scriptLoad(decrScript);

  // Load token bucket script
  const tokenScript = await fs.readFile(
    path.join(scriptsDir, 'token_bucket.lua'), 
    'utf8'
  );
  scripts.tokenBucket = await redisClient.scriptLoad(tokenScript);

  console.log('Loaded Lua scripts:', scripts);
  return scripts;
}

module.exports = { loadLuaScripts };

