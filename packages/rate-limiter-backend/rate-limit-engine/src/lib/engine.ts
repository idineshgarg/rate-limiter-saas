import type { Redis } from 'ioredis';
import { registerRateLimiterCommands } from './redis-commands.js';
import { FixedWindowStrategy } from './strategies/fixed-window.strategy.js';
import { LeakyBucketStrategy } from './strategies/leaky-bucket.strategy.js';
import { SlidingWindowStrategy } from './strategies/sliding-window.strategy.js';
import { TokenBucketStrategy } from './strategies/token-bucket.strategy.js';
import type {
  ConsumeParams,
  PeekParams,
  PeekResult,
  RateLimitAlgorithm,
  RateLimitResult,
  RateLimitStrategy,
} from './types.js';

export class RateLimiterEngine {
  private readonly strategies: Record<RateLimitAlgorithm, RateLimitStrategy>;

  constructor(redis: Redis) {
    const client = registerRateLimiterCommands(redis);
    this.strategies = {
      FIXED_WINDOW: new FixedWindowStrategy(client),
      SLIDING_WINDOW: new SlidingWindowStrategy(client),
      LEAKY_BUCKET: new LeakyBucketStrategy(client),
      TOKEN_BUCKET: new TokenBucketStrategy(client),
    };
  }

  consume(algorithm: RateLimitAlgorithm, params: ConsumeParams): Promise<RateLimitResult> {
    return this.strategies[algorithm].consume(params);
  }

  peek(algorithm: RateLimitAlgorithm, params: PeekParams): Promise<PeekResult> {
    return this.strategies[algorithm].peek(params);
  }
}

export function createRateLimiterEngine(redis: Redis): RateLimiterEngine {
  return new RateLimiterEngine(redis);
}
