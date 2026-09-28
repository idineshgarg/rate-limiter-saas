export interface Tenant {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export type ApiKeyStatus = 'ACTIVE' | 'REVOKED';

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  status: ApiKeyStatus;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreatedApiKey extends ApiKeySummary {
  /** Only present once, in the response right after creation. */
  key: string;
}

export type RateLimitAlgorithm =
  | 'FIXED_WINDOW'
  | 'SLIDING_WINDOW'
  | 'LEAKY_BUCKET'
  | 'TOKEN_BUCKET';

export type RuleScope = 'API_KEY' | 'IDENTIFIER';

export interface RateLimitRule {
  id: string;
  apiKeyId: string;
  resource: string;
  algorithm: RateLimitAlgorithm;
  scope: RuleScope;
  limit: number;
  windowMs: number | null;
  capacity: number | null;
  refillRatePerMs: number | null;
  leakRatePerMs: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateRuleInput {
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

export interface RuleUsage {
  limit: number;
  remaining: number;
  resetMs: number;
}
