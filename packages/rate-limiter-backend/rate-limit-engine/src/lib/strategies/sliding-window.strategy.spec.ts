import { randomUUID } from 'node:crypto';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRateLimiterEngine, type RateLimiterEngine } from '../engine.js';
import type { ConsumeParams } from '../types.js';

describe('SlidingWindowStrategy', () => {
  let container: StartedRedisContainer;
  let redis: Redis;
  let engine: RateLimiterEngine;

  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').start();
    redis = new Redis(container.getConnectionUrl());
    engine = createRateLimiterEngine(redis);
  });

  afterAll(async () => {
    await redis.quit();
    await container.stop();
  });

  function params(overrides: Partial<ConsumeParams> = {}): ConsumeParams {
    return {
      apiKeyId: randomUUID(),
      ruleId: randomUUID(),
      identifier: 'default',
      limit: 5,
      windowMs: 60_000,
      ...overrides,
    };
  }

  it('allows requests up to the limit', async () => {
    const p = params();
    for (let i = 0; i < p.limit; i++) {
      const result = await engine.consume('SLIDING_WINDOW', p);
      expect(result.allowed).toBe(true);
    }
  });

  it('denies requests once the limit is exceeded within the window', async () => {
    const p = params();
    for (let i = 0; i < p.limit; i++) {
      await engine.consume('SLIDING_WINDOW', p);
    }
    const result = await engine.consume('SLIDING_WINDOW', p);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('admits new requests as old ones age out of the window', async () => {
    const p = params({ windowMs: 500 });
    for (let i = 0; i < p.limit; i++) {
      await engine.consume('SLIDING_WINDOW', p);
    }
    expect((await engine.consume('SLIDING_WINDOW', p)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 700));

    const result = await engine.consume('SLIDING_WINDOW', p);
    expect(result.allowed).toBe(true);
  });

  it('allows exactly `limit` requests under concurrent load', async () => {
    const p = params({ limit: 10 });
    const attempts = 25;

    const results = await Promise.all(
      Array.from({ length: attempts }, () => engine.consume('SLIDING_WINDOW', p)),
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(p.limit);
  });
});
