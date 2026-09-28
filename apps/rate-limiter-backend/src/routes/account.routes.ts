import {
  createSessionAuthMiddleware,
  generateApiKey,
  hashApiKey,
  UnauthorizedError,
  verifySessionToken,
  type VerifySessionToken,
} from '@dg/rate-limiter-backend-auth';
import type { ApiKey, ApiKeysRepository } from '@dg/rate-limiter-backend-data-access';
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';

export interface AccountRouterDeps {
  apiKeysRepo: ApiKeysRepository;
  sessionSecret: string;
  apiKeyPepper: string;
}

function toPublicApiKey(apiKey: ApiKey) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.keyPrefix,
    status: apiKey.status,
    createdAt: apiKey.createdAt,
    lastUsedAt: apiKey.lastUsedAt,
  };
}

/** Self-service API-key management for the signed-in tenant (dashboard use). */
export function createAccountRouter(deps: AccountRouterDeps): Router {
  const router = Router();
  const verifyToken: VerifySessionToken = (token) => verifySessionToken(token, deps.sessionSecret);
  router.use(createSessionAuthMiddleware(verifyToken));

  router.get(
    '/api-keys',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.session as NonNullable<typeof req.session>;
      const keys = await deps.apiKeysRepo.listForTenant(tenantId);
      res.json(keys.map(toPublicApiKey));
    }),
  );

  router.post(
    '/api-keys',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.session as NonNullable<typeof req.session>;
      const { name } = req.body ?? {};
      if (typeof name !== 'string' || !name.trim()) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: '"name" is required' } });
        return;
      }

      const generated = generateApiKey();
      const hashedKey = hashApiKey(generated.raw, deps.apiKeyPepper);
      const apiKey = await deps.apiKeysRepo.create({
        tenantId,
        name,
        keyPrefix: generated.prefix,
        hashedKey,
      });

      // The raw key is only ever visible here, once — only its hash is persisted.
      res.status(201).json({ ...toPublicApiKey(apiKey), key: generated.raw });
    }),
  );

  router.delete(
    '/api-keys/:id',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.session as NonNullable<typeof req.session>;
      const apiKey = await deps.apiKeysRepo.findById(req.params.id);
      if (!apiKey || apiKey.tenantId !== tenantId) {
        throw new UnauthorizedError('No such API key on this account');
      }
      await deps.apiKeysRepo.revoke(apiKey.id);
      res.status(204).send();
    }),
  );

  return router;
}
