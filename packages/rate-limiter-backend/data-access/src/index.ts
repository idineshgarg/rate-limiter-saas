export { createPrismaClient } from './lib/client.js';
export type { PrismaClient } from './lib/client.js';

export { TenantsRepository } from './lib/tenants.repository.js';
export type { CreateTenantInput } from './lib/tenants.repository.js';

export { ApiKeysRepository } from './lib/api-keys.repository.js';
export type { CreateApiKeyInput } from './lib/api-keys.repository.js';

export { RateLimitRulesRepository } from './lib/rate-limit-rules.repository.js';
export type {
  CreateRateLimitRuleInput,
  UpdateRateLimitRuleInput,
} from './lib/rate-limit-rules.repository.js';

export type {
  ApiKey,
  RateLimitRule,
  Tenant,
} from './generated/prisma/client.js';
export {
  ApiKeyStatus,
  RateLimitAlgorithm,
  RuleScope,
} from './generated/prisma/enums.js';
