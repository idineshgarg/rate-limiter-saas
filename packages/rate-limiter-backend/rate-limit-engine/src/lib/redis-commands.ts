import type { Redis } from 'ioredis';
import { FIXED_WINDOW_LUA, FIXED_WINDOW_PEEK_LUA } from './scripts/fixed-window.lua.js';
import { LEAKY_BUCKET_LUA, LEAKY_BUCKET_PEEK_LUA } from './scripts/leaky-bucket.lua.js';
import { SLIDING_WINDOW_LUA, SLIDING_WINDOW_PEEK_LUA } from './scripts/sliding-window.lua.js';
import { TOKEN_BUCKET_LUA, TOKEN_BUCKET_PEEK_LUA } from './scripts/token-bucket.lua.js';

export type LuaResult = [allowed: number, remaining: number, resetOrRetryAfterMs: number];
export type LuaPeekResult = [remaining: number, resetMs: number];

/** Custom Lua commands registered on the client — not known to ioredis's own command types. */
export interface RateLimiterCommands {
  rlFixedWindow(
    key: string,
    windowMs: number,
    limit: number,
    cost: number,
  ): Promise<LuaResult>;
  rlSlidingWindow(
    key: string,
    now: number,
    windowMs: number,
    limit: number,
    member: string,
    cost: number,
  ): Promise<LuaResult>;
  rlLeakyBucket(
    key: string,
    now: number,
    capacity: number,
    leakRatePerMs: number,
    cost: number,
  ): Promise<LuaResult>;
  rlTokenBucket(
    key: string,
    now: number,
    capacity: number,
    refillRatePerMs: number,
    cost: number,
  ): Promise<LuaResult>;

  rlPeekFixedWindow(key: string, limit: number): Promise<LuaPeekResult>;
  rlPeekSlidingWindow(
    key: string,
    now: number,
    windowMs: number,
    limit: number,
  ): Promise<LuaPeekResult>;
  rlPeekLeakyBucket(
    key: string,
    now: number,
    capacity: number,
    leakRatePerMs: number,
  ): Promise<LuaPeekResult>;
  rlPeekTokenBucket(
    key: string,
    now: number,
    capacity: number,
    refillRatePerMs: number,
  ): Promise<LuaPeekResult>;
}

export type RateLimiterRedisClient = Redis & RateLimiterCommands;

const registeredClients = new WeakSet<Redis>();

/**
 * Registers the rate-limiter Lua commands on the given client. Each ioredis
 * instance holds its own command set, so this must run once per instance
 * (calling defineCommand twice for the same name on the same instance throws).
 */
export function registerRateLimiterCommands(redis: Redis): RateLimiterRedisClient {
  const client = redis as RateLimiterRedisClient;
  if (registeredClients.has(redis)) {
    return client;
  }

  redis.defineCommand('rlFixedWindow', { numberOfKeys: 1, lua: FIXED_WINDOW_LUA });
  redis.defineCommand('rlSlidingWindow', { numberOfKeys: 1, lua: SLIDING_WINDOW_LUA });
  redis.defineCommand('rlLeakyBucket', { numberOfKeys: 1, lua: LEAKY_BUCKET_LUA });
  redis.defineCommand('rlTokenBucket', { numberOfKeys: 1, lua: TOKEN_BUCKET_LUA });

  redis.defineCommand('rlPeekFixedWindow', {
    numberOfKeys: 1,
    lua: FIXED_WINDOW_PEEK_LUA,
    readOnly: true,
  });
  redis.defineCommand('rlPeekSlidingWindow', {
    numberOfKeys: 1,
    lua: SLIDING_WINDOW_PEEK_LUA,
    readOnly: true,
  });
  redis.defineCommand('rlPeekLeakyBucket', {
    numberOfKeys: 1,
    lua: LEAKY_BUCKET_PEEK_LUA,
    readOnly: true,
  });
  redis.defineCommand('rlPeekTokenBucket', {
    numberOfKeys: 1,
    lua: TOKEN_BUCKET_PEEK_LUA,
    readOnly: true,
  });

  registeredClients.add(redis);

  return client;
}
