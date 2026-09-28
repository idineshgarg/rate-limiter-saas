import type { PrismaClient, RateLimitRule } from '../generated/prisma/client.js';
import type {
  RateLimitAlgorithm,
  RuleScope,
} from '../generated/prisma/enums.js';

export interface CreateRateLimitRuleInput {
  tenantId: string;
  apiKeyId: string;
  resource: string;
  algorithm: RateLimitAlgorithm;
  scope?: RuleScope;
  limit: number;
  windowMs?: number;
  capacity?: number;
  refillRatePerMs?: number;
  leakRatePerMs?: number;
}

export type UpdateRateLimitRuleInput = Partial<
  Omit<CreateRateLimitRuleInput, 'tenantId' | 'apiKeyId'>
>;

export class RateLimitRulesRepository {
  constructor(private readonly prisma: PrismaClient) { }

  create(input: CreateRateLimitRuleInput): Promise<RateLimitRule> {
    return this.prisma.rateLimitRule.create({ data: input });
  }

  findById(id: string): Promise<RateLimitRule | null> {
    return this.prisma.rateLimitRule.findUnique({ where: { id } });
  }

  listForTenant(tenantId: string): Promise<RateLimitRule[]> {
    return this.prisma.rateLimitRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findActiveByApiKeyAndResource(
    apiKeyId: string,
    resource: string,
  ): Promise<RateLimitRule | null> {
    return this.prisma.rateLimitRule.findFirst({
      where: { apiKeyId, resource, isActive: true },
    });
  }

  update(
    id: string,
    input: UpdateRateLimitRuleInput,
  ): Promise<RateLimitRule> {
    return this.prisma.rateLimitRule.update({ where: { id }, data: input });
  }

  deactivate(id: string): Promise<RateLimitRule> {
    return this.prisma.rateLimitRule.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
