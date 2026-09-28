import { buildRateLimitKey } from '../key.js';
import type { RateLimiterRedisClient } from '../redis-commands.js';
import type {
  ConsumeParams,
  PeekParams,
  PeekResult,
  RateLimitResult,
  RateLimitStrategy,
} from '../types.js';

export class TokenBucketStrategy implements RateLimitStrategy {
  readonly algorithm = 'TOKEN_BUCKET' as const;

  constructor(private readonly redis: RateLimiterRedisClient) {}

  async consume(params: ConsumeParams): Promise<RateLimitResult> {
    if (!params.refillRatePerMs) {
      throw new Error('TOKEN_BUCKET requires refillRatePerMs');
    }
    const capacity = params.capacity ?? params.limit;
    const key = buildRateLimitKey(this.algorithm, params);
    const cost = params.cost ?? 1;
    const now = Date.now();

    const [allowed, remaining, resetOrRetryAfterMs] = await this.redis.rlTokenBucket(
      key,
      now,
      capacity,
      params.refillRatePerMs,
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

  async peek(params: PeekParams): Promise<PeekResult> {
    if (!params.refillRatePerMs) {
      throw new Error('TOKEN_BUCKET requires refillRatePerMs');
    }
    const capacity = params.capacity ?? params.limit;
    const key = buildRateLimitKey(this.algorithm, params);

    const [remaining, resetMs] = await this.redis.rlPeekTokenBucket(
      key,
      Date.now(),
      capacity,
      params.refillRatePerMs,
    );
    return { limit: capacity, remaining, resetMs };
  }
}
