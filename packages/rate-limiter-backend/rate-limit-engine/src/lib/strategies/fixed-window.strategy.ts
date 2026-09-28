import { buildRateLimitKey } from '../key.js';
import type { RateLimiterRedisClient } from '../redis-commands.js';
import type { ConsumeParams, RateLimitResult, RateLimitStrategy } from '../types.js';

export class FixedWindowStrategy implements RateLimitStrategy {
  readonly algorithm = 'FIXED_WINDOW' as const;

  constructor(private readonly redis: RateLimiterRedisClient) {}

  async consume(params: ConsumeParams): Promise<RateLimitResult> {
    if (!params.windowMs) {
      throw new Error('FIXED_WINDOW requires windowMs');
    }
    const key = buildRateLimitKey(this.algorithm, params);
    const cost = params.cost ?? 1;

    const [allowed, current, ttlMs] = await this.redis.rlFixedWindow(
      key,
      params.windowMs,
      params.limit,
      cost,
    );

    return {
      allowed: allowed === 1,
      limit: params.limit,
      remaining: Math.max(0, params.limit - current),
      resetMs: ttlMs,
      ...(allowed === 1 ? {} : { retryAfterMs: ttlMs }),
    };
  }
}
