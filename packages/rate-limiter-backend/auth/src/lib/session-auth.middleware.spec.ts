import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  createSessionAuthMiddleware,
  SESSION_COOKIE_NAME,
  type VerifySessionToken,
} from './session-auth.middleware.js';
import { UnauthorizedError } from './errors.js';

function makeReq(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

describe('createSessionAuthMiddleware', () => {
  it('rejects when the session cookie is missing', () => {
    const verifySessionToken: VerifySessionToken = vi.fn();
    const middleware = createSessionAuthMiddleware(verifySessionToken);
    const next = vi.fn();

    middleware(makeReq(), {} as Response, next as NextFunction);

    expect(verifySessionToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rejects when the token fails verification', () => {
    const verifySessionToken: VerifySessionToken = vi.fn().mockReturnValue(null);
    const middleware = createSessionAuthMiddleware(verifySessionToken);
    const req = makeReq({ [SESSION_COOKIE_NAME]: 'bad-token' });
    const next = vi.fn();

    middleware(req, {} as Response, next as NextFunction);

    expect(verifySessionToken).toHaveBeenCalledWith('bad-token');
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('attaches session and calls next() with no error on success', () => {
    const session = { tenantId: 't1' };
    const verifySessionToken: VerifySessionToken = vi.fn().mockReturnValue(session);
    const middleware = createSessionAuthMiddleware(verifySessionToken);
    const req = makeReq({ [SESSION_COOKIE_NAME]: 'good-token' });
    const next = vi.fn();

    middleware(req, {} as Response, next as NextFunction);

    expect(req.session).toEqual(session);
    expect(next).toHaveBeenCalledWith();
  });
});
