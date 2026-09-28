import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from './api-client.js';

function mockFetchOnce(response: Partial<Response> & { jsonBody?: unknown }) {
  const { jsonBody, ...rest } = response;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => jsonBody,
      ...rest,
    } as Response),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiClient', () => {
  it('sends credentials and JSON content-type on every request', async () => {
    mockFetchOnce({ jsonBody: { id: 't1', name: 'Acme', email: 'a@a.com', createdAt: '' } });
    await apiClient.me();

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.credentials).toBe('include');
    expect((options?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  it('returns parsed JSON on success', async () => {
    mockFetchOnce({ jsonBody: [{ id: 'k1' }] });
    await expect(apiClient.listApiKeys()).resolves.toEqual([{ id: 'k1' }]);
  });

  it('returns undefined for 204 No Content responses', async () => {
    mockFetchOnce({ status: 204, jsonBody: undefined });
    await expect(apiClient.logout()).resolves.toBeUndefined();
  });

  it('throws an ApiError with the server-provided code and message on failure', async () => {
    mockFetchOnce({
      ok: false,
      status: 409,
      jsonBody: { error: { code: 'CONFLICT', message: 'Email already in use' } },
    });

    await expect(apiClient.signup({ name: 'x', email: 'x@x.com', password: 'password123' })).rejects.toMatchObject(
      { status: 409, code: 'CONFLICT', message: 'Email already in use' } satisfies Partial<ApiError>,
    );
  });

  it('getRuleUsage omits the identifier query param when none is given', async () => {
    mockFetchOnce({ jsonBody: { limit: 5, remaining: 5, resetMs: 0 } });
    await apiClient.getRuleUsage('rule-1');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://localhost:3333/v1/account/rules/rule-1/usage');
  });

  it('getRuleUsage URL-encodes the identifier query param when given', async () => {
    mockFetchOnce({ jsonBody: { limit: 5, remaining: 5, resetMs: 0 } });
    await apiClient.getRuleUsage('rule-1', 'user with spaces');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(
      'http://localhost:3333/v1/account/rules/rule-1/usage?identifier=user%20with%20spaces',
    );
  });
});
