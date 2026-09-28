import { createApiKeyAuthMiddleware, type VerifyApiKey } from '@org/rate-limiter-backend-auth';
import type { RuleService } from '@org/rate-limiter-backend-rules';
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';

export interface RulesRouterDeps {
  ruleService: RuleService;
  verifyApiKey: VerifyApiKey;
}

/** Tenant-scoped CRUD for rate-limit rules, authenticated via X-API-Key. */
export function createRulesRouter(deps: RulesRouterDeps): Router {
  const router = Router();
  router.use(createApiKeyAuthMiddleware(deps.verifyApiKey));

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { tenantId, apiKeyId } = req.authContext as NonNullable<typeof req.authContext>;
      const rule = await deps.ruleService.createRule(tenantId, apiKeyId, req.body);
      res.status(201).json(rule);
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.authContext as NonNullable<typeof req.authContext>;
      res.json(await deps.ruleService.listRules(tenantId));
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.authContext as NonNullable<typeof req.authContext>;
      res.json(await deps.ruleService.getRule(tenantId, req.params.id));
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.authContext as NonNullable<typeof req.authContext>;
      res.json(await deps.ruleService.updateRule(tenantId, req.params.id, req.body));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.authContext as NonNullable<typeof req.authContext>;
      await deps.ruleService.deactivateRule(tenantId, req.params.id);
      res.status(204).send();
    }),
  );

  return router;
}
