import fs from 'fs/promises';
import path from 'path';

async function loadLuaScripts(redisClient: any) {
  const scriptsDir = path.join(__dirname, '../../scripts');
  const scripts: Record<string, any> = {};

  const decrScript = await fs.readFile(path.join(scriptsDir, 'decr_inventory.lua'), 'utf8');
  scripts.decrInventory = await redisClient.scriptLoad(decrScript);

  const tokenScript = await fs.readFile(path.join(scriptsDir, 'token_bucket.lua'), 'utf8');
  scripts.tokenBucket = await redisClient.scriptLoad(tokenScript);

  console.log('Loaded Lua scripts:', scripts);
  return scripts;
}

export { loadLuaScripts };
(module as any).exports = { loadLuaScripts };
