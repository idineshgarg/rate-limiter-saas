// KEYS[1] = key
// ARGV[1] = windowMs
// ARGV[2] = limit
// ARGV[3] = cost
// returns { allowed(0|1), current, ttlMs }
export const FIXED_WINDOW_LUA = `
local key = KEYS[1]
local windowMs = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])

local current = redis.call('INCRBY', key, cost)
if current == cost then
  redis.call('PEXPIRE', key, windowMs)
end
local ttl = redis.call('PTTL', key)
if ttl < 0 then
  ttl = windowMs
  redis.call('PEXPIRE', key, windowMs)
end

if current > limit then
  return {0, current, ttl}
else
  return {1, current, ttl}
end
`;

// Read-only — reports current usage without consuming a request.
// KEYS[1] = key
// ARGV[1] = limit
// returns { remaining, ttlMs }
export const FIXED_WINDOW_PEEK_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])

local current = tonumber(redis.call('GET', key)) or 0
local ttl = redis.call('PTTL', key)
if ttl < 0 then
  ttl = 0
end

local remaining = limit - current
if remaining < 0 then
  remaining = 0
end

return {remaining, ttl}
`;
