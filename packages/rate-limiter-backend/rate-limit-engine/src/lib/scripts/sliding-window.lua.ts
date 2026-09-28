// KEYS[1] = key
// ARGV[1] = now (ms)
// ARGV[2] = windowMs
// ARGV[3] = limit
// ARGV[4] = member (unique id for this request's ZSET entry)
// ARGV[5] = cost
// returns { allowed(0|1), count, ttlOrRetryAfterMs }
export const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local cost = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
local count = redis.call('ZCARD', key)

if count + cost <= limit then
  for i = 1, cost do
    redis.call('ZADD', key, now, member .. ':' .. i)
  end
  redis.call('PEXPIRE', key, windowMs)
  return {1, count + cost, windowMs}
else
  redis.call('PEXPIRE', key, windowMs)
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = windowMs
  if #oldest == 2 then
    retryAfter = windowMs - (now - tonumber(oldest[2]))
    if retryAfter < 0 then
      retryAfter = 0
    end
  end
  return {0, count, retryAfter}
end
`;
