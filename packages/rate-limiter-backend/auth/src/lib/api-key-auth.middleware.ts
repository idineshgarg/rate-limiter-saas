import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UnauthorizedError } from './errors.js';
import type { AuthContext } from './types.js';

declare module 'express' {
  interface Request {
    authContext?: AuthContext;
  }
}

const API_KEY_HEADER = 'x-api-key';

export type VerifyApiKey = (rawKey: string) => Promise<AuthContext | null>;

/**
 * Express middleware factory for `X-API-Key` auth. Takes an injected lookup
 * function rather than a Prisma client directly, so this lib stays free of
 * any data-access dependency and is trivially unit-testable with a fake.
 */
export function createApiKeyAuthMiddleware(verifyApiKey: VerifyApiKey): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header(API_KEY_HEADER);
    if (!header) {
      next(new UnauthorizedError('Missing X-API-Key header'));
      return;
    }

    verifyApiKey(header)
      .then((authContext) => {
        if (!authContext) {
          next(new UnauthorizedError('Invalid or revoked API key'));
          return;
        }
        req.authContext = authContext;
        next();
      })
      .catch(next);
  };
}
