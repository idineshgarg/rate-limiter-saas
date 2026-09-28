import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UnauthorizedError } from './errors.js';
import type { SessionContext } from './session.js';

declare module 'express' {
  interface Request {
    session?: SessionContext;
  }
}

export const SESSION_COOKIE_NAME = 'rl_session';

export type VerifySessionToken = (token: string) => SessionContext | null;

/**
 * Express middleware for the dashboard's own cookie-based login session —
 * distinct from the X-Api-Key auth used by the rate-limit API itself.
 * Takes an injected verify function (no direct jsonwebtoken/secret coupling)
 * so this stays trivially unit-testable with a fake.
 */
export function createSessionAuthMiddleware(verifySessionToken: VerifySessionToken): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token !== 'string') {
      next(new UnauthorizedError('Not signed in'));
      return;
    }
    const session = verifySessionToken(token);
    if (!session) {
      next(new UnauthorizedError('Session expired or invalid'));
      return;
    }
    req.session = session;
    next();
  };
}
