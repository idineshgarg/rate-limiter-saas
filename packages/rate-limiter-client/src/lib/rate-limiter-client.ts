export type RateLimitAlgorithm = 'FIXED_WINDOW' | 'SLIDING_WINDOW' | 'LEAKY_BUCKET' | 'TOKEN_BUCKET';

export interface RateLimiterClientOptions {
  /** A tenant's raw API key, sent as the `X-Api-Key` header. */
  apiKey: string;
  /** Base URL of the rate-limiter API, e.g. `https://api.example.com`. */
  baseUrl: string;
  /** Override the `fetch` implementation (defaults to the global `fetch`). */
  fetch?: typeof fetch;
}

export interface CheckOptions {
  /** The resource being protected, e.g. `checkout-api`. */
  resource: string;
  /** Required when the matched rule's scope is IDENTIFIER (e.g. a user or IP). */
  identifier?: string;
  /** How much of the limit this request consumes. Defaults to 1 server-side. */
  cost?: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  algorithm: RateLimitAlgorithm;
  /** Present when allowed: milliseconds until the limit resets. */
  resetMs?: number;
  /** Present when denied: milliseconds to wait before retrying. */
  retryAfterMs?: number;
}

/** Thrown for anything other than a normal allowed/denied check result (auth, validation, network, server errors). */
export class RateLimiterApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RateLimiterApiError';
  }
}

/** Thin client for the rate-limiter SaaS's `/v1/rate-limit/check` enforcement endpoint. */
export class RateLimiterClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RateLimiterClientOptions) {
    if (!options.apiKey) {
      throw new Error('RateLimiterClient requires an apiKey');
    }
    if (!options.baseUrl) {
      throw new Error('RateLimiterClient requires a baseUrl');
    }

    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new Error(
        'No fetch implementation available in this environment; pass one via options.fetch',
      );
    }

    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
  }

  /**
   * Checks and consumes against the active rule configured for `resource`,
   * returning whether the request is allowed. Never throws for a normal
   * allow/deny outcome (HTTP 200/429) — only for auth, validation, or
   * transport failures.
   */
  async check(options: CheckOptions): Promise<RateLimitCheckResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/v1/rate-limit/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({
        resource: options.resource,
        ...(options.identifier !== undefined ? { identifier: options.identifier } : {}),
        ...(options.cost !== undefined ? { cost: options.cost } : {}),
      }),
    });

    const body: unknown = await response.json().catch(() => null);

    if (response.status === 200 || response.status === 429) {
      return body as RateLimitCheckResult;
    }

    const errorBody = body as { error?: { code?: string; message?: string } } | null;
    throw new RateLimiterApiError(
      response.status,
      errorBody?.error?.code ?? 'UNKNOWN_ERROR',
      errorBody?.error?.message ?? `Request failed with status ${response.status}`,
    );
  }
}
