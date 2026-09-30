import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { rateLimitMiddleware } from './express-middleware.js';
import { RateLimiterApiError, type RateLimiterClient } from './rate-limiter-client.js';

function fakeClient(check: RateLimiterClient['check']): RateLimiterClient {
  return { check } as unknown as RateLimiterClient;
}

function fakeRes(): Response {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('rateLimitMiddleware', () => {
  it('calls next() and sets rate-limit headers when allowed', async () => {
    const client = fakeClient(
      vi.fn().mockResolvedValue({ allowed: true, limit: 10, remaining: 9, algorithm: 'TOKEN_BUCKET', resetMs: 1000 }),
    );
    const middleware = rateLimitMiddleware(client, { resource: 'checkout-api' });
    const req = {} as Request;
    const res = fakeRes();
    const next = vi.fn();

    await Promise.resolve(middleware(req, res, next));

    expect(next).toHaveBeenCalledWith();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 429 with Retry-After when denied, by default', async () => {
    const client = fakeClient(
      vi.fn().mockResolvedValue({
        allowed: false,
        limit: 10,
        remaining: 0,
        algorithm: 'TOKEN_BUCKET',
        retryAfterMs: 2500,
      }),
    );
    const middleware = rateLimitMiddleware(client, { resource: 'checkout-api' });
    const req = {} as Request;
    const res = fakeRes();
    const next = vi.fn();

    await Promise.resolve(middleware(req, res, next));

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '3');
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too many requests' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls onDenied instead of the default response when provided', async () => {
    const client = fakeClient(
      vi.fn().mockResolvedValue({ allowed: false, limit: 10, remaining: 0, algorithm: 'TOKEN_BUCKET' }),
    );
    const onDenied = vi.fn();
    const middleware = rateLimitMiddleware(client, { resource: 'checkout-api', onDenied });
    const req = {} as Request;
    const res = fakeRes();
    const next = vi.fn();

    await Promise.resolve(middleware(req, res, next));

    expect(onDenied).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('derives resource and identifier from the request when given functions', async () => {
    const check = vi.fn().mockResolvedValue({ allowed: true, limit: 10, remaining: 9, algorithm: 'TOKEN_BUCKET' });
    const client = fakeClient(check);
    const middleware = rateLimitMiddleware(client, {
      resource: (req) => `tenant-${(req as unknown as { tenantId: string }).tenantId}`,
      identifier: (req) => (req as unknown as { userId: string }).userId,
    });
    const req = { tenantId: 't1', userId: 'u1' } as unknown as Request;

    await Promise.resolve(middleware(req, fakeRes(), vi.fn()));

    expect(check).toHaveBeenCalledWith({ resource: 'tenant-t1', identifier: 'u1', cost: undefined });
  });

  it('propagates errors to next() by default', async () => {
    const error = new RateLimiterApiError(401, 'UNAUTHORIZED', 'Invalid key');
    const client = fakeClient(vi.fn().mockRejectedValue(error));
    const middleware = rateLimitMiddleware(client, { resource: 'checkout-api' });
    const next = vi.fn();

    await Promise.resolve(middleware({} as Request, fakeRes(), next));

    expect(next).toHaveBeenCalledWith(error);
  });

  it('calls onError instead of next() when provided', async () => {
    const error = new Error('network down');
    const client = fakeClient(vi.fn().mockRejectedValue(error));
    const onError = vi.fn();
    const middleware = rateLimitMiddleware(client, { resource: 'checkout-api', onError });
    const next = vi.fn();

    await Promise.resolve(middleware({} as Request, fakeRes(), next));

    expect(onError).toHaveBeenCalledWith(error, {}, expect.anything(), next);
    expect(next).not.toHaveBeenCalled();
  });
});
