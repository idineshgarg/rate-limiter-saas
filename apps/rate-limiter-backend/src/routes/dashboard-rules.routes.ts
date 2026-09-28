import {
  createSessionAuthMiddleware,
  UnauthorizedError,
  verifySessionToken,
  type VerifySessionToken,
} from '@dg/rate-limiter-backend-auth';
import type { ApiKeysRepository } from '@dg/rate-limiter-backend-data-access';
import type { RateLimiterEngine } from '@dg/rate-limiter-backend-rate-limit-engine';
import type { RuleService } from '@dg/rate-limiter-backend-rules';
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';

const DEFAULT_IDENTIFIER = 'default';

export interface DashboardRulesRouterDeps {
  ruleService: RuleService;
  apiKeysRepo: ApiKeysRepository;
  engine: RateLimiterEngine;
  sessionSecret: string;
}

/**
 * Session-authed rule management for the dashboard — lets a signed-in tenant
 * manage rules without needing their raw API key (only shown once at
 * creation). Rules always belong to one apiKeyId, so creation must verify
 * the given apiKeyId actually belongs to the signed-in tenant.
 */
export function createDashboardRulesRouter(deps: DashboardRulesRouterDeps): Router {
  const router = Router();
  const verifyToken: VerifySessionToken = (token) => verifySessionToken(token, deps.sessionSecret);
  router.use(createSessionAuthMiddleware(verifyToken));

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.session as NonNullable<typeof req.session>;
      res.json(await deps.ruleService.listRules(tenantId));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.session as NonNullable<typeof req.session>;
      const { apiKeyId } = req.body ?? {};
      if (typeof apiKeyId !== 'string') {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: '"apiKeyId" is required' } });
        return;
      }

      const apiKey = await deps.apiKeysRepo.findById(apiKeyId);
      if (!apiKey || apiKey.tenantId !== tenantId) {
        throw new UnauthorizedError('No such API key on this account');
      }

      const rule = await deps.ruleService.createRule(tenantId, apiKeyId, req.body);
      res.status(201).json(rule);
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.session as NonNullable<typeof req.session>;
      res.json(await deps.ruleService.getRule(tenantId, req.params.id));
    }),
  );

  router.get(
    '/:id/usage',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.session as NonNullable<typeof req.session>;
      const rule = await deps.ruleService.getRule(tenantId, req.params.id);

      const queryIdentifier =
        typeof req.query.identifier === 'string' ? req.query.identifier : undefined;
      deps.ruleService.assertIdentifierProvided(rule, queryIdentifier);
      const identifier = rule.scope === 'IDENTIFIER' ? (queryIdentifier as string) : DEFAULT_IDENTIFIER;

      const usage = await deps.engine.peek(rule.algorithm, {
        apiKeyId: rule.apiKeyId,
        ruleId: rule.id,
        identifier,
        limit: rule.limit,
        windowMs: rule.windowMs ?? undefined,
        capacity: rule.capacity ?? undefined,
        refillRatePerMs: rule.refillRatePerMs ?? undefined,
        leakRatePerMs: rule.leakRatePerMs ?? undefined,
      });

      res.json(usage);
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.session as NonNullable<typeof req.session>;
      res.json(await deps.ruleService.updateRule(tenantId, req.params.id, req.body));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const { tenantId } = req.session as NonNullable<typeof req.session>;
      await deps.ruleService.deactivateRule(tenantId, req.params.id);
      res.status(204).send();
    }),
  );

  return router;
}
