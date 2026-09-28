// KEYS[1] = key
// ARGV[1] = now (ms)
// ARGV[2] = capacity
// ARGV[3] = refillRatePerMs
// ARGV[4] = cost
// returns { allowed(0|1), remaining, resetOrRetryAfterMs }
export const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillRatePerMs = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsed = now - ts
if elapsed > 0 then
  tokens = math.min(capacity, tokens + elapsed * refillRatePerMs)
end

if tokens >= cost then
  tokens = tokens - cost
  redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
  local ttlMs = math.ceil((capacity - tokens) / refillRatePerMs) + 1000
  redis.call('PEXPIRE', key, ttlMs)
  return {1, math.floor(tokens), ttlMs}
else
  redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
  local retryAfter = math.ceil((cost - tokens) / refillRatePerMs)
  redis.call('PEXPIRE', key, retryAfter + 1000)
  return {0, math.floor(tokens), retryAfter}
end
`;

// Read-only — reports current usage without consuming a request (no HMSET/PEXPIRE).
// KEYS[1] = key
// ARGV[1] = now (ms)
// ARGV[2] = capacity
// ARGV[3] = refillRatePerMs
// returns { remaining, resetMs }
export const TOKEN_BUCKET_PEEK_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillRatePerMs = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  return {capacity, 0}
end

local elapsed = now - ts
if elapsed > 0 then
  tokens = math.min(capacity, tokens + elapsed * refillRatePerMs)
end

local resetMs = math.max(0, math.ceil((capacity - tokens) / refillRatePerMs))

return {math.floor(tokens), resetMs}
`;
