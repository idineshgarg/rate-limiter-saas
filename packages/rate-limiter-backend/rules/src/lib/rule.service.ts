import type {
  RateLimitRule,
  RateLimitRulesRepository,
} from '@org/rate-limiter-backend-data-access';
import { ValidationError, RuleNotFoundError } from './errors.js';
import { parseOrThrow } from './parse.js';
import { createRuleSchema, updateRuleSchema } from './schemas.js';

export class RuleService {
  constructor(private readonly rulesRepo: RateLimitRulesRepository) {}

  async createRule(
    tenantId: string,
    apiKeyId: string,
    input: unknown,
  ): Promise<RateLimitRule> {
    const dto = parseOrThrow(createRuleSchema, input);
    return this.rulesRepo.create({ tenantId, apiKeyId, ...dto });
  }

  listRules(tenantId: string): Promise<RateLimitRule[]> {
    return this.rulesRepo.listForTenant(tenantId);
  }

  async getRule(tenantId: string, id: string): Promise<RateLimitRule> {
    const rule = await this.rulesRepo.findById(id);
    if (!rule || rule.tenantId !== tenantId) {
      throw new RuleNotFoundError(`No rule with id "${id}"`);
    }
    return rule;
  }

  async updateRule(
    tenantId: string,
    id: string,
    input: unknown,
  ): Promise<RateLimitRule> {
    await this.getRule(tenantId, id);
    const dto = parseOrThrow(updateRuleSchema, input);
    return this.rulesRepo.update(id, dto);
  }

  async deactivateRule(tenantId: string, id: string): Promise<RateLimitRule> {
    await this.getRule(tenantId, id);
    return this.rulesRepo.deactivate(id);
  }

  /** Resolves the active rule an enforcement request should be checked against. */
  async resolveRuleForRequest(
    apiKeyId: string,
    resource: string,
  ): Promise<RateLimitRule> {
    const rule = await this.rulesRepo.findActiveByApiKeyAndResource(
      apiKeyId,
      resource,
    );
    if (!rule) {
      throw new RuleNotFoundError(
        `No active rate-limit rule configured for resource "${resource}"`,
      );
    }
    return rule;
  }

  /** IDENTIFIER-scoped rules need a caller-supplied identifier to key the limit on. */
  assertIdentifierProvided(rule: RateLimitRule, identifier: string | undefined): void {
    if (rule.scope === 'IDENTIFIER' && !identifier) {
      throw new ValidationError(
        `Rule for resource "${rule.resource}" requires an "identifier" in the request body`,
      );
    }
  }
}
