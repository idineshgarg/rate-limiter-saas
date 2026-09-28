// KEYS[1] = key
// ARGV[1] = now (ms)
// ARGV[2] = capacity
// ARGV[3] = leakRatePerMs
// ARGV[4] = cost
// returns { allowed(0|1), remaining, resetOrRetryAfterMs }
export const LEAKY_BUCKET_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local leakRatePerMs = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'level', 'ts')
local level = tonumber(data[1])
local ts = tonumber(data[2])
if level == nil then
  level = 0
  ts = now
end

local elapsed = now - ts
if elapsed > 0 then
  level = math.max(0, level - elapsed * leakRatePerMs)
end

local ttlMs
if level + cost <= capacity then
  level = level + cost
  redis.call('HMSET', key, 'level', level, 'ts', now)
  ttlMs = math.ceil(level / leakRatePerMs) + 1000
  redis.call('PEXPIRE', key, ttlMs)
  return {1, math.floor(capacity - level), ttlMs}
else
  redis.call('HMSET', key, 'level', level, 'ts', now)
  ttlMs = math.ceil(level / leakRatePerMs) + 1000
  redis.call('PEXPIRE', key, ttlMs)
  local retryAfter = math.ceil((level + cost - capacity) / leakRatePerMs)
  return {0, math.floor(capacity - level), retryAfter}
end
`;
