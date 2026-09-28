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
