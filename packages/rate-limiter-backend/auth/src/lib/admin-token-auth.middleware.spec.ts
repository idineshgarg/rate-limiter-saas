import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createAdminTokenAuthMiddleware } from './admin-token-auth.middleware.js';
import { UnauthorizedError } from './errors.js';

function makeReq(header?: string): Request {
  return {
    header: (name: string) => (name.toLowerCase() === 'x-admin-token' ? header : undefined),
  } as unknown as Request;
}

describe('createAdminTokenAuthMiddleware', () => {
  const middleware = createAdminTokenAuthMiddleware('correct-token');

  it('rejects a missing header', () => {
    const next = vi.fn();
    middleware(makeReq(undefined), {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rejects an incorrect token', () => {
    const next = vi.fn();
    middleware(makeReq('wrong-token'), {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('calls next() with no error for the correct token', () => {
    const next = vi.fn();
    middleware(makeReq('correct-token'), {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });
});
