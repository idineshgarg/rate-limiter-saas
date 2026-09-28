export const RATE_LIMIT_ALGORITHMS = [
  'FIXED_WINDOW',
  'SLIDING_WINDOW',
  'LEAKY_BUCKET',
  'TOKEN_BUCKET',
] as const;

export type RateLimitAlgorithm = (typeof RATE_LIMIT_ALGORITHMS)[number];

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Milliseconds until the limit fully resets (allowed) or the window/bucket empties. */
  resetMs: number;
  /** Present only when `allowed` is false: milliseconds to wait before retrying. */
  retryAfterMs?: number;
}

export interface ConsumeParams {
  /** Owning API key — namespaces the Redis key so tenants never collide. */
  apiKeyId: string;
  /** The rule being enforced — namespaces the key per resource/config. */
  ruleId: string;
  /** Caller-supplied identifier for IDENTIFIER-scoped rules, or "default" for API_KEY-scoped rules. */
  identifier: string;
  /** Max requests allowed (fixed/sliding window) or bucket capacity (leaky/token bucket). */
  limit: number;
  /** Window length in ms — required for FIXED_WINDOW / SLIDING_WINDOW. */
  windowMs?: number;
  /** Bucket capacity — required for LEAKY_BUCKET / TOKEN_BUCKET (defaults to `limit` if omitted). */
  capacity?: number;
  /** Tokens added per ms — required for TOKEN_BUCKET. */
  refillRatePerMs?: number;
  /** Units drained per ms — required for LEAKY_BUCKET. */
  leakRatePerMs?: number;
  /** Cost of this request against the bucket/window (default 1). */
  cost?: number;
}

export interface RateLimitStrategy {
  readonly algorithm: RateLimitAlgorithm;
  consume(params: ConsumeParams): Promise<RateLimitResult>;
}
