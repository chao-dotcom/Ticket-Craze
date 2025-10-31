-- File: scripts/decr_inventory.lua
-- KEYS[1] -> inventory key (e.g., "inv:sku:123")
-- ARGV[1] -> decrement amount (quantity to purchase)
-- ARGV[2] -> reservation key prefix (e.g., "resv:sku:123")
-- ARGV[3] -> reservationId (unique identifier)
-- ARGV[4] -> TTL in seconds (reservation expiry)

local inv = tonumber(redis.call("GET", KEYS[1]) or "-1")
local dec = tonumber(ARGV[1])

-- Check if inventory key exists
if inv == -1 then
  return redis.error_reply("NO_INVENTORY_KEY")
end

-- Check if sufficient stock
if inv < dec then
  return {0, inv}  -- {success=0, current_inventory}
end

-- Atomically decrement inventory
local new_inv = redis.call("DECRBY", KEYS[1], dec)

-- Create reservation record with TTL
if ARGV[2] and ARGV[3] and ARGV[4] then
  local resv_key = ARGV[2] .. ":" .. ARGV[3]
  redis.call("HMSET", resv_key, 
    "qty", dec, 
    "createdAt", redis.call("TIME")[1],
    "status", "pending"
  )
  redis.call("EXPIRE", resv_key, tonumber(ARGV[4]))
end

return {1, new_inv}  -- {success=1, new_inventory}

