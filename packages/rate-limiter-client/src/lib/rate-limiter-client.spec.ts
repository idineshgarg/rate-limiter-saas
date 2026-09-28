import { describe, expect, it, vi } from 'vitest';
import { RateLimiterApiError, RateLimiterClient } from './rate-limiter-client.js';

function fakeFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe('RateLimiterClient', () => {
  it('requires an apiKey and a baseUrl', () => {
    expect(() => new RateLimiterClient({ apiKey: '', baseUrl: 'https://api.example.com' })).toThrow(
      /apiKey/,
    );
    expect(() => new RateLimiterClient({ apiKey: 'rlk_test', baseUrl: '' })).toThrow(/baseUrl/);
  });

  it('sends the resource, identifier, cost and X-Api-Key header', async () => {
    const fetchImpl = fakeFetch(200, {
      allowed: true,
      limit: 100,
      remaining: 99,
      resetMs: 1000,
      algorithm: 'TOKEN_BUCKET',
    });
    const client = new RateLimiterClient({
      apiKey: 'rlk_test',
      baseUrl: 'https://api.example.com/',
      fetch: fetchImpl,
    });

    const result = await client.check({ resource: 'checkout-api', identifier: 'user-1', cost: 2 });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/v1/rate-limit/check',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Api-Key': 'rlk_test' }),
        body: JSON.stringify({ resource: 'checkout-api', identifier: 'user-1', cost: 2 }),
      }),
    );
    expect(result).toEqual({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetMs: 1000,
      algorithm: 'TOKEN_BUCKET',
    });
  });

  it('returns a denied result on 429 instead of throwing', async () => {
    const client = new RateLimiterClient({
      apiKey: 'rlk_test',
      baseUrl: 'https://api.example.com',
      fetch: fakeFetch(429, {
        allowed: false,
        limit: 100,
        remaining: 0,
        retryAfterMs: 5000,
        algorithm: 'TOKEN_BUCKET',
      }),
    });

    const result = await client.check({ resource: 'checkout-api' });

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(5000);
  });

  it('throws RateLimiterApiError for auth failures', async () => {
    const client = new RateLimiterClient({
      apiKey: 'bad-key',
      baseUrl: 'https://api.example.com',
      fetch: fakeFetch(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid or revoked API key' } }),
    });

    await expect(client.check({ resource: 'checkout-api' })).rejects.toMatchObject(
      new RateLimiterApiError(401, 'UNAUTHORIZED', 'Invalid or revoked API key'),
    );
  });

  it('throws RateLimiterApiError with a fallback code/message when the body is unparsable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    }) as unknown as typeof fetch;
    const client = new RateLimiterClient({ apiKey: 'rlk_test', baseUrl: 'https://api.example.com', fetch: fetchImpl });

    await expect(client.check({ resource: 'checkout-api' })).rejects.toMatchObject({
      status: 500,
      code: 'UNKNOWN_ERROR',
    });
  });
});
