import {
  createAdminTokenAuthMiddleware,
  generateApiKey,
  hashApiKey,
} from '@dg/rate-limiter-backend-auth';
import type {
  ApiKeysRepository,
  TenantsRepository,
} from '@dg/rate-limiter-backend-data-access';
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';

export interface AdminRouterDeps {
  tenantsRepo: TenantsRepository;
  apiKeysRepo: ApiKeysRepository;
  adminToken: string;
  apiKeyPepper: string;
}

/**
 * Operator-only bootstrap endpoints, gated by a static X-Admin-Token — there's
 * no self-service tenant signup in this MVP.
 */
export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();
  router.use(createAdminTokenAuthMiddleware(deps.adminToken));

  router.post(
    '/tenants',
    asyncHandler(async (req, res) => {
      const { name, email } = req.body ?? {};
      if (typeof name !== 'string' || typeof email !== 'string') {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: '"name" and "email" are required' },
        });
        return;
      }
      const tenant = await deps.tenantsRepo.create({ name, email });
      res.status(201).json(tenant);
    }),
  );

  router.post(
    '/tenants/:tenantId/api-keys',
    asyncHandler(async (req, res) => {
      const { name } = req.body ?? {};
      if (typeof name !== 'string') {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: '"name" is required' } });
        return;
      }

      const generated = generateApiKey();
      const hashedKey = hashApiKey(generated.raw, deps.apiKeyPepper);
      const apiKey = await deps.apiKeysRepo.create({
        tenantId: req.params.tenantId,
        name,
        keyPrefix: generated.prefix,
        hashedKey,
      });

      // The raw key is only ever visible here, once — only its hash is persisted.
      res.status(201).json({
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.keyPrefix,
        key: generated.raw,
      });
    }),
  );

  router.delete(
    '/api-keys/:id',
    asyncHandler(async (req, res) => {
      await deps.apiKeysRepo.revoke(req.params.id);
      res.status(204).send();
    }),
  );

  return router;
}
