import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createApiKeyAuthMiddleware, type VerifyApiKey } from './api-key-auth.middleware.js';
import { UnauthorizedError } from './errors.js';

function makeReq(header?: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === 'x-api-key' ? header : undefined),
  } as unknown as Request;
}

describe('createApiKeyAuthMiddleware', () => {
  it('calls next() with an UnauthorizedError when the header is missing', async () => {
    const verifyApiKey: VerifyApiKey = vi.fn();
    const middleware = createApiKeyAuthMiddleware(verifyApiKey);
    const next = vi.fn();

    middleware(makeReq(undefined), {} as Response, next as NextFunction);
    await new Promise((resolve) => setImmediate(resolve));

    expect(verifyApiKey).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('calls next() with an UnauthorizedError when the key does not resolve', async () => {
    const verifyApiKey: VerifyApiKey = vi.fn().mockResolvedValue(null);
    const middleware = createApiKeyAuthMiddleware(verifyApiKey);
    const req = makeReq('rlk_bad');
    const next = vi.fn();

    middleware(req, {} as Response, next as NextFunction);
    await new Promise((resolve) => setImmediate(resolve));

    expect(verifyApiKey).toHaveBeenCalledWith('rlk_bad');
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('attaches authContext and calls next() with no error on success', async () => {
    const authContext = { tenantId: 't1', apiKeyId: 'k1' };
    const verifyApiKey: VerifyApiKey = vi.fn().mockResolvedValue(authContext);
    const middleware = createApiKeyAuthMiddleware(verifyApiKey);
    const req = makeReq('rlk_good');
    const next = vi.fn();

    middleware(req, {} as Response, next as NextFunction);
    await new Promise((resolve) => setImmediate(resolve));

    expect(req.authContext).toEqual(authContext);
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards unexpected errors from verifyApiKey to next()', async () => {
    const boom = new Error('db down');
    const verifyApiKey: VerifyApiKey = vi.fn().mockRejectedValue(boom);
    const middleware = createApiKeyAuthMiddleware(verifyApiKey);
    const next = vi.fn();

    middleware(makeReq('rlk_x'), {} as Response, next as NextFunction);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(boom);
  });
});
