import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UnauthorizedError } from './errors.js';

const ADMIN_TOKEN_HEADER = 'x-admin-token';

/**
 * Gates the tenant/API-key bootstrap endpoints behind a static shared secret.
 * There's no self-service signup in this MVP — this is an operator-only door.
 */
export function createAdminTokenAuthMiddleware(adminToken: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header(ADMIN_TOKEN_HEADER);
    if (!header || header !== adminToken) {
      next(new UnauthorizedError('Missing or invalid X-Admin-Token header'));
      return;
    }
    next();
  };
}
