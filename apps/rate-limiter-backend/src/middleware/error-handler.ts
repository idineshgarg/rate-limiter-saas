import { ConflictError, UnauthorizedError } from '@dg/rate-limiter-backend-auth';
import { RuleNotFoundError, ValidationError } from '@dg/rate-limiter-backend-rules';
import type { NextFunction, Request, Response } from 'express';

interface KnownError extends Error {
  code: string;
}

function isKnownError(err: unknown): err is KnownError {
  return (
    err instanceof ValidationError ||
    err instanceof UnauthorizedError ||
    err instanceof RuleNotFoundError ||
    err instanceof ConflictError
  );
}

const STATUS_BY_ERROR = new Map<unknown, number>([
  [ValidationError, 400],
  [UnauthorizedError, 401],
  [RuleNotFoundError, 404],
  [ConflictError, 409],
]);

function statusFor(err: KnownError): number {
  for (const [ctor, status] of STATUS_BY_ERROR) {
    if (err instanceof (ctor as new (...args: never[]) => Error)) {
      return status;
    }
  }
  return 500;
}

// Express recognizes error-handling middleware by arity — all four
// parameters must stay, even though `_next` is unused.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (isKnownError(err)) {
    res.status(statusFor(err)).json({ error: { code: err.code, message: err.message } });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
