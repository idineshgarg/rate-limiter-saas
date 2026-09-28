import type { ConsumeParams, RateLimitAlgorithm } from './types.js';

const ALGO_PREFIX: Record<RateLimitAlgorithm, string> = {
  FIXED_WINDOW: 'fw',
  SLIDING_WINDOW: 'sw',
  LEAKY_BUCKET: 'lb',
  TOKEN_BUCKET: 'tb',
};

export function buildRateLimitKey(
  algorithm: RateLimitAlgorithm,
  params: Pick<ConsumeParams, 'apiKeyId' | 'ruleId' | 'identifier'>,
): string {
  return `ratelimit:${ALGO_PREFIX[algorithm]}:${params.apiKeyId}:${params.ruleId}:${params.identifier}`;
}
