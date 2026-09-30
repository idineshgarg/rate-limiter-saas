import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { RateLimitCheckResult } from './rate-limiter-client.js';
import type { RateLimiterClient } from './rate-limiter-client.js';

export interface RateLimitMiddlewareOptions {
  /** The resource to check, or a function deriving it from the request. */
  resource: string | ((req: Request) => string);
  /** Required only for IDENTIFIER-scoped rules, e.g. `(req) => req.ip`. */
  identifier?: (req: Request) => string | undefined;
  /** How much of the limit this request consumes. Defaults to 1 server-side. */
  cost?: number;
  /** Called instead of the default 429 JSON response when a request is denied. */
  onDenied?: (result: RateLimitCheckResult, req: Request, res: Response) => void;
  /**
   * Called instead of `next(error)` when the check itself fails (auth,
   * validation, or transport error — not a normal allow/deny outcome).
   * Defaults to propagating to Express's error-handling middleware, which
   * fails the request closed. Override this if you'd rather fail open.
   */
  onError?: (error: unknown, req: Request, res: Response, next: NextFunction) => void;
}

/**
 * Wraps a `RateLimiterClient` as Express middleware. Sets `X-RateLimit-*`
 * response headers on every request, and `Retry-After` plus a 429 on denied
 * ones (both overridable via `onDenied`).
 */
export function rateLimitMiddleware(
  client: RateLimiterClient,
  options: RateLimitMiddlewareOptions,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const resource = typeof options.resource === 'function' ? options.resource(req) : options.resource;
      const identifier = options.identifier?.(req);

      const result = await client.check({ resource, identifier, cost: options.cost });

      res.setHeader('X-RateLimit-Limit', String(result.limit));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));

      if (!result.allowed) {
        if (result.retryAfterMs !== undefined) {
          res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
        }
        if (options.onDenied) {
          options.onDenied(result, req, res);
        } else {
          res.status(429).json({ error: 'Too many requests' });
        }
        return;
      }

      next();
    } catch (error) {
      if (options.onError) {
        options.onError(error, req, res, next);
      } else {
        next(error);
      }
    }
  };
}
