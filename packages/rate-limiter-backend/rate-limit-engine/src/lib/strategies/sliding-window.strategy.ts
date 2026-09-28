import { randomUUID } from 'node:crypto';
import { buildRateLimitKey } from '../key.js';
import type { RateLimiterRedisClient } from '../redis-commands.js';
import type {
  ConsumeParams,
  PeekParams,
  PeekResult,
  RateLimitResult,
  RateLimitStrategy,
} from '../types.js';

export class SlidingWindowStrategy implements RateLimitStrategy {
  readonly algorithm = 'SLIDING_WINDOW' as const;

  constructor(private readonly redis: RateLimiterRedisClient) {}

  async consume(params: ConsumeParams): Promise<RateLimitResult> {
    if (!params.windowMs) {
      throw new Error('SLIDING_WINDOW requires windowMs');
    }
    const key = buildRateLimitKey(this.algorithm, params);
    const cost = params.cost ?? 1;
    const now = Date.now();
    // Unique per-request member so two requests in the same millisecond never collide in the ZSET.
    const member = `${now}-${randomUUID()}`;

    const [allowed, count, resetOrRetryAfterMs] = await this.redis.rlSlidingWindow(
      key,
      now,
      params.windowMs,
      params.limit,
      member,
      cost,
    );

    return {
      allowed: allowed === 1,
      limit: params.limit,
      remaining: Math.max(0, params.limit - count),
      resetMs: allowed === 1 ? resetOrRetryAfterMs : params.windowMs,
      ...(allowed === 1 ? {} : { retryAfterMs: resetOrRetryAfterMs }),
    };
  }

  async peek(params: PeekParams): Promise<PeekResult> {
    if (!params.windowMs) {
      throw new Error('SLIDING_WINDOW requires windowMs');
    }
    const key = buildRateLimitKey(this.algorithm, params);
    const [remaining, resetMs] = await this.redis.rlPeekSlidingWindow(
      key,
      Date.now(),
      params.windowMs,
      params.limit,
    );
    return { limit: params.limit, remaining, resetMs };
  }
}
