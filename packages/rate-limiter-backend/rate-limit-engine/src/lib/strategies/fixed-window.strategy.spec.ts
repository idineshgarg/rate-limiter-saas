import { randomUUID } from 'node:crypto';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRateLimiterEngine, type RateLimiterEngine } from '../engine.js';
import type { ConsumeParams } from '../types.js';

describe('FixedWindowStrategy', () => {
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
      const result = await engine.consume('FIXED_WINDOW', p);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(p.limit - (i + 1));
    }
  });

  it('denies requests once the limit is exceeded', async () => {
    const p = params();
    for (let i = 0; i < p.limit; i++) {
      await engine.consume('FIXED_WINDOW', p);
    }
    const result = await engine.consume('FIXED_WINDOW', p);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets once the window elapses', async () => {
    const p = params({ windowMs: 500 });
    for (let i = 0; i < p.limit; i++) {
      await engine.consume('FIXED_WINDOW', p);
    }
    expect((await engine.consume('FIXED_WINDOW', p)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 700));

    const result = await engine.consume('FIXED_WINDOW', p);
    expect(result.allowed).toBe(true);
  });

  it('allows exactly `limit` requests under concurrent load', async () => {
    const p = params({ limit: 10 });
    const attempts = 25;

    const results = await Promise.all(
      Array.from({ length: attempts }, () => engine.consume('FIXED_WINDOW', p)),
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(p.limit);
  });

  describe('peek', () => {
    it('reports full remaining for a never-used key without creating one', async () => {
      const p = params();
      const result = await engine.peek('FIXED_WINDOW', p);
      expect(result).toEqual({ limit: p.limit, remaining: p.limit, resetMs: 0 });
    });

    it('reflects consumed requests without consuming one itself', async () => {
      const p = params();
      await engine.consume('FIXED_WINDOW', p);
      await engine.consume('FIXED_WINDOW', p);

      const peeked = await engine.peek('FIXED_WINDOW', p);
      expect(peeked.remaining).toBe(p.limit - 2);

      // Peeking again must not have changed anything.
      const peekedAgain = await engine.peek('FIXED_WINDOW', p);
      expect(peekedAgain.remaining).toBe(p.limit - 2);
    });
  });
});
