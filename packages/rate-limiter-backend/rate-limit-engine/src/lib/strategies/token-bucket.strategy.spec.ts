import { randomUUID } from 'node:crypto';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRateLimiterEngine, type RateLimiterEngine } from '../engine.js';
import type { ConsumeParams } from '../types.js';

describe('TokenBucketStrategy', () => {
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
      capacity: 5,
      refillRatePerMs: 5 / 1000, // fully refills in ~1s
      ...overrides,
    };
  }

  it('allows requests up to bucket capacity (burst)', async () => {
    const p = params();
    for (let i = 0; i < (p.capacity as number); i++) {
      const result = await engine.consume('TOKEN_BUCKET', p);
      expect(result.allowed).toBe(true);
    }
  });

  it('denies requests once tokens are exhausted', async () => {
    const p = params();
    for (let i = 0; i < (p.capacity as number); i++) {
      await engine.consume('TOKEN_BUCKET', p);
    }
    const result = await engine.consume('TOKEN_BUCKET', p);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('admits new requests as tokens refill over time', async () => {
    const p = params();
    for (let i = 0; i < (p.capacity as number); i++) {
      await engine.consume('TOKEN_BUCKET', p);
    }
    expect((await engine.consume('TOKEN_BUCKET', p)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const result = await engine.consume('TOKEN_BUCKET', p);
    expect(result.allowed).toBe(true);
  });

  it('allows exactly `capacity` requests under concurrent load', async () => {
    const p = params({ capacity: 10, refillRatePerMs: 10 / 5000 });
    const attempts = 25;

    const results = await Promise.all(
      Array.from({ length: attempts }, () => engine.consume('TOKEN_BUCKET', p)),
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(p.capacity);
  });

  describe('peek', () => {
    it('reports full remaining for a never-used key without creating one', async () => {
      const p = params();
      const result = await engine.peek('TOKEN_BUCKET', p);
      expect(result).toEqual({ limit: p.capacity, remaining: p.capacity, resetMs: 0 });
    });

    it('reflects consumed requests without consuming one itself', async () => {
      const p = params();
      await engine.consume('TOKEN_BUCKET', p);
      await engine.consume('TOKEN_BUCKET', p);

      const peeked = await engine.peek('TOKEN_BUCKET', p);
      expect(peeked.remaining).toBe((p.capacity as number) - 2);

      const peekedAgain = await engine.peek('TOKEN_BUCKET', p);
      expect(peekedAgain.remaining).toBe((p.capacity as number) - 2);
    });
  });
});
