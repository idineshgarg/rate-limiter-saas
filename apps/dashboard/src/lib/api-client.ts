import type {
  ApiKeySummary,
  CreatedApiKey,
  CreateRuleInput,
  RateLimitRule,
  RuleUsage,
  Tenant,
} from './types.js';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.code ?? 'UNKNOWN', body?.error?.message ?? res.statusText);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export const apiClient = {
  signup: (input: { name: string; email: string; password: string }) =>
    post<Tenant>('/v1/auth/signup', input),
  login: (input: { email: string; password: string }) => post<Tenant>('/v1/auth/login', input),
  logout: () => request<void>('/v1/auth/logout', { method: 'POST' }),
  me: () => request<Tenant>('/v1/auth/me'),

  listApiKeys: () => request<ApiKeySummary[]>('/v1/account/api-keys'),
  createApiKey: (name: string) => post<CreatedApiKey>('/v1/account/api-keys', { name }),
  revokeApiKey: (id: string) =>
    request<void>(`/v1/account/api-keys/${id}`, { method: 'DELETE' }),

  listRules: () => request<RateLimitRule[]>('/v1/account/rules'),
  createRule: (input: CreateRuleInput) => post<RateLimitRule>('/v1/account/rules', input),
  deleteRule: (id: string) => request<void>(`/v1/account/rules/${id}`, { method: 'DELETE' }),
  getRuleUsage: (id: string, identifier?: string) =>
    request<RuleUsage>(
      `/v1/account/rules/${id}/usage${identifier ? `?identifier=${encodeURIComponent(identifier)}` : ''}`,
    ),
};
