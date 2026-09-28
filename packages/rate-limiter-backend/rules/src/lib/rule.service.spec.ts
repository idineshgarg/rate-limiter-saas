import type {
  RateLimitRule,
  RateLimitRulesRepository,
} from '@dg/rate-limiter-backend-data-access';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RuleNotFoundError, ValidationError } from './errors.js';
import { RuleService } from './rule.service.js';

function makeRule(overrides: Partial<RateLimitRule> = {}): RateLimitRule {
  return {
    id: 'rule-1',
    tenantId: 'tenant-1',
    apiKeyId: 'key-1',
    resource: 'checkout-api',
    algorithm: 'FIXED_WINDOW',
    scope: 'API_KEY',
    limit: 100,
    windowMs: 60_000,
    capacity: null,
    refillRatePerMs: null,
    leakRatePerMs: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as RateLimitRule;
}

function makeRepo(): RateLimitRulesRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    listForTenant: vi.fn(),
    findActiveByApiKeyAndResource: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  } as unknown as RateLimitRulesRepository;
}

describe('RuleService', () => {
  let repo: RateLimitRulesRepository;
  let service: RuleService;

  beforeEach(() => {
    repo = makeRepo();
    service = new RuleService(repo);
  });

  describe('createRule', () => {
    it('validates and delegates to the repository', async () => {
      const rule = makeRule();
      vi.mocked(repo.create).mockResolvedValue(rule);

      const result = await service.createRule('tenant-1', 'key-1', {
        resource: 'checkout-api',
        algorithm: 'FIXED_WINDOW',
        limit: 100,
        windowMs: 60_000,
      });

      expect(result).toBe(rule);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          apiKeyId: 'key-1',
          resource: 'checkout-api',
          algorithm: 'FIXED_WINDOW',
        }),
      );
    });

    it('throws ValidationError for an invalid payload without touching the repository', async () => {
      await expect(
        service.createRule('tenant-1', 'key-1', { resource: '', algorithm: 'FIXED_WINDOW' }),
      ).rejects.toThrow(ValidationError);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('getRule', () => {
    it('throws RuleNotFoundError when the rule belongs to a different tenant', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRule({ tenantId: 'other-tenant' }));
      await expect(service.getRule('tenant-1', 'rule-1')).rejects.toThrow(RuleNotFoundError);
    });

    it('throws RuleNotFoundError when no rule exists', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.getRule('tenant-1', 'missing')).rejects.toThrow(RuleNotFoundError);
    });

    it('returns the rule when it belongs to the tenant', async () => {
      const rule = makeRule();
      vi.mocked(repo.findById).mockResolvedValue(rule);
      await expect(service.getRule('tenant-1', 'rule-1')).resolves.toBe(rule);
    });
  });

  describe('resolveRuleForRequest', () => {
    it('throws RuleNotFoundError when no active rule matches', async () => {
      vi.mocked(repo.findActiveByApiKeyAndResource).mockResolvedValue(null);
      await expect(
        service.resolveRuleForRequest('key-1', 'checkout-api'),
      ).rejects.toThrow(RuleNotFoundError);
    });

    it('returns the matching active rule', async () => {
      const rule = makeRule();
      vi.mocked(repo.findActiveByApiKeyAndResource).mockResolvedValue(rule);
      await expect(service.resolveRuleForRequest('key-1', 'checkout-api')).resolves.toBe(rule);
    });
  });

  describe('assertIdentifierProvided', () => {
    it('throws when scope is IDENTIFIER and no identifier is given', () => {
      const rule = makeRule({ scope: 'IDENTIFIER' });
      expect(() => service.assertIdentifierProvided(rule, undefined)).toThrow(ValidationError);
    });

    it('does not throw when scope is IDENTIFIER and an identifier is given', () => {
      const rule = makeRule({ scope: 'IDENTIFIER' });
      expect(() => service.assertIdentifierProvided(rule, 'user_123')).not.toThrow();
    });

    it('does not throw when scope is API_KEY regardless of identifier', () => {
      const rule = makeRule({ scope: 'API_KEY' });
      expect(() => service.assertIdentifierProvided(rule, undefined)).not.toThrow();
    });
  });
});
