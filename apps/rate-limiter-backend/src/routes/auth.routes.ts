import {
  ConflictError,
  SESSION_COOKIE_NAME,
  createSessionAuthMiddleware,
  hashPassword,
  signSessionToken,
  UnauthorizedError,
  verifyPassword,
  verifySessionToken,
  type VerifySessionToken,
} from '@dg/rate-limiter-backend-auth';
import type { Tenant, TenantsRepository } from '@dg/rate-limiter-backend-data-access';
import { Router, type CookieOptions } from 'express';
import { asyncHandler } from '../lib/async-handler.js';

export interface AuthRouterDeps {
  tenantsRepo: TenantsRepository;
  sessionSecret: string;
}

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches the JWT's own 7d expiry

function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  };
}

function toPublicTenant(tenant: Tenant) {
  return { id: tenant.id, name: tenant.name, email: tenant.email, createdAt: tenant.createdAt };
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const verifyToken: VerifySessionToken = (token) => verifySessionToken(token, deps.sessionSecret);

  router.post(
    '/signup',
    asyncHandler(async (req, res) => {
      const { name, email, password } = req.body ?? {};
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '"name" is required' } });
        return;
      }
      if (typeof email !== 'string' || !email.trim()) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: '"email" is required' } });
        return;
      }
      if (typeof password !== 'string' || password.length < 8) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: '"password" is required and must be at least 8 characters',
          },
        });
        return;
      }

      const existing = await deps.tenantsRepo.findByEmail(email);
      if (existing) {
        throw new ConflictError('An account with this email already exists');
      }

      const passwordHash = await hashPassword(password);
      const tenant = await deps.tenantsRepo.create({ name, email, passwordHash });

      const token = signSessionToken({ tenantId: tenant.id }, deps.sessionSecret);
      res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
      res.status(201).json(toPublicTenant(tenant));
    }),
  );

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: '"email" and "password" are required' } });
        return;
      }

      const tenant = await deps.tenantsRepo.findByEmail(email);
      // Same error either way — never reveal whether the email exists.
      if (!tenant || !tenant.passwordHash || !(await verifyPassword(password, tenant.passwordHash))) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const token = signSessionToken({ tenantId: tenant.id }, deps.sessionSecret);
      res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
      res.status(200).json(toPublicTenant(tenant));
    }),
  );

  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, { ...sessionCookieOptions(), maxAge: undefined });
    res.status(204).send();
  });

  router.get(
    '/me',
    createSessionAuthMiddleware(verifyToken),
    asyncHandler(async (req, res) => {
      const { tenantId } = req.session as NonNullable<typeof req.session>;
      const tenant = await deps.tenantsRepo.findById(tenantId);
      if (!tenant) {
        throw new UnauthorizedError('Session refers to a tenant that no longer exists');
      }
      res.json(toPublicTenant(tenant));
    }),
  );

  return router;
}
