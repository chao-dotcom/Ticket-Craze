-- File: scripts/token_bucket.lua
-- KEYS[1] = bucket key (e.g., "bucket:user:123")
-- ARGV[1] = capacity (max tokens)
-- ARGV[2] = refill_rate (tokens per second)
-- ARGV[3] = current_timestamp (seconds)
-- ARGV[4] = tokens_needed (usually 1)

local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local needed = tonumber(ARGV[4])

-- Get current tokens and last refill time
local data = redis.call("HMGET", KEYS[1], "tokens", "last")
local tokens = tonumber(data[1]) or capacity
local last = tonumber(data[2]) or now

-- Calculate token refill
local elapsed = math.max(0, now - last)
tokens = math.min(capacity, tokens + elapsed * rate)

-- Check if enough tokens
if tokens < needed then
  redis.call("HMSET", KEYS[1], "tokens", tokens, "last", now)
  redis.call("EXPIRE", KEYS[1], 3600)  -- cleanup after 1 hour
  return 0  -- rate limit exceeded
end

-- Consume tokens
tokens = tokens - needed
redis.call("HMSET", KEYS[1], "tokens", tokens, "last", now)
redis.call("EXPIRE", KEYS[1], 3600)
return 1  -- success

