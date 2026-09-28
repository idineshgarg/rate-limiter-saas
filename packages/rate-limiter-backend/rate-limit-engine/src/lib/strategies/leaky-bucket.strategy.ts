import { buildRateLimitKey } from '../key.js';
import type { RateLimiterRedisClient } from '../redis-commands.js';
import type { ConsumeParams, RateLimitResult, RateLimitStrategy } from '../types.js';

export class LeakyBucketStrategy implements RateLimitStrategy {
  readonly algorithm = 'LEAKY_BUCKET' as const;

  constructor(private readonly redis: RateLimiterRedisClient) {}

  async consume(params: ConsumeParams): Promise<RateLimitResult> {
    if (!params.leakRatePerMs) {
      throw new Error('LEAKY_BUCKET requires leakRatePerMs');
    }
    const capacity = params.capacity ?? params.limit;
    const key = buildRateLimitKey(this.algorithm, params);
    const cost = params.cost ?? 1;
    const now = Date.now();

    const [allowed, remaining, resetOrRetryAfterMs] = await this.redis.rlLeakyBucket(
      key,
      now,
      capacity,
      params.leakRatePerMs,
      cost,
    );

    return {
      allowed: allowed === 1,
      limit: capacity,
      remaining,
      resetMs: resetOrRetryAfterMs,
      ...(allowed === 1 ? {} : { retryAfterMs: resetOrRetryAfterMs }),
    };
  }
}
