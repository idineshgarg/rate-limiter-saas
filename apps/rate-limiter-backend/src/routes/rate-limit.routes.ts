import { createApiKeyAuthMiddleware, type VerifyApiKey } from '@org/rate-limiter-backend-auth';
import type { RateLimiterEngine } from '@org/rate-limiter-backend-rate-limit-engine';
import { checkRequestSchema, parseOrThrow, type RuleService } from '@org/rate-limiter-backend-rules';
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';

export interface RateLimitRouterDeps {
  ruleService: RuleService;
  engine: RateLimiterEngine;
  verifyApiKey: VerifyApiKey;
}

const DEFAULT_IDENTIFIER = 'default';

/** The core enforcement endpoint: checks and consumes against a tenant's configured rule. */
export function createRateLimitRouter(deps: RateLimitRouterDeps): Router {
  const router = Router();
  router.use(createApiKeyAuthMiddleware(deps.verifyApiKey));

  router.post(
    '/check',
    asyncHandler(async (req, res) => {
      const { apiKeyId } = req.authContext as NonNullable<typeof req.authContext>;
      const dto = parseOrThrow(checkRequestSchema, req.body);

      const rule = await deps.ruleService.resolveRuleForRequest(apiKeyId, dto.resource);
      deps.ruleService.assertIdentifierProvided(rule, dto.identifier);
      const identifier = rule.scope === 'IDENTIFIER' ? (dto.identifier as string) : DEFAULT_IDENTIFIER;

      const result = await deps.engine.consume(rule.algorithm, {
        apiKeyId: rule.apiKeyId,
        ruleId: rule.id,
        identifier,
        limit: rule.limit,
        windowMs: rule.windowMs ?? undefined,
        capacity: rule.capacity ?? undefined,
        refillRatePerMs: rule.refillRatePerMs ?? undefined,
        leakRatePerMs: rule.leakRatePerMs ?? undefined,
        cost: dto.cost,
      });

      res.setHeader('X-RateLimit-Limit', String(result.limit));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', String(result.resetMs));

      if (!result.allowed) {
        res.setHeader('Retry-After', String(Math.ceil((result.retryAfterMs ?? 0) / 1000)));
        res.status(429).json({
          allowed: false,
          limit: result.limit,
          remaining: result.remaining,
          retryAfterMs: result.retryAfterMs,
          algorithm: rule.algorithm,
        });
        return;
      }

      res.status(200).json({
        allowed: true,
        limit: result.limit,
        remaining: result.remaining,
        resetMs: result.resetMs,
        algorithm: rule.algorithm,
      });
    }),
  );

  return router;
}
