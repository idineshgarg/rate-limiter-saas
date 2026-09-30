import { useState, type FormEvent } from 'react';
import { API_URL } from '../lib/api-client.js';
import type { RateLimitCheckResult } from '../lib/types.js';

interface TesterError {
  status: number;
  code: string;
  message: string;
}

/**
 * Calls the real POST /v1/rate-limit/check endpoint directly with a raw API
 * key — the same call the SDK's check() makes — so it can't be routed
 * through apiClient (which is cookie-session-authenticated for account
 * endpoints, not X-Api-Key-authenticated for this one).
 */
export function ApiTester() {
  const [apiKey, setApiKey] = useState('');
  const [resource, setResource] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RateLimitCheckResult | null>(null);
  const [error, setError] = useState<TesterError | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  async function runCheck(e: FormEvent) {
    e.preventDefault();
    setRunning(true);
    setResult(null);
    setError(null);
    const start = performance.now();
    try {
      const res = await fetch(`${API_URL}/v1/rate-limit/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({
          resource,
          ...(identifier.trim() ? { identifier: identifier.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      setDurationMs(Math.round(performance.now() - start));

      if (res.status === 200 || res.status === 429) {
        setResult(body as RateLimitCheckResult);
      } else {
        setError({
          status: res.status,
          code: body?.error?.code ?? 'UNKNOWN_ERROR',
          message: body?.error?.message ?? `Request failed with status ${res.status}`,
        });
      }
    } catch {
      setDurationMs(Math.round(performance.now() - start));
      setError({ status: 0, code: 'NETWORK_ERROR', message: 'Could not reach the API' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel">
      <h2>Try it live</h2>
      <p className="panel-description">
        Calls <code>POST {API_URL}/v1/rate-limit/check</code> directly from your browser with a
        real API key — the exact request the SDK's <code>check()</code> makes. Paste a raw key
        from one of your API keys above (only shown once, at creation time).
      </p>
      <form className="rule-form" onSubmit={runCheck}>
        <div className="form-row">
          <label>
            API key
            <input
              placeholder="rlk_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
          </label>
          <label>
            Resource
            <input
              placeholder="e.g. checkout-api"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              required
            />
          </label>
          <label>
            Identifier (optional)
            <input
              placeholder="required only for IDENTIFIER-scoped rules"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </label>
        </div>
        <button type="submit" disabled={running}>
          {running ? 'Checking…' : 'Run check'}
        </button>
      </form>

      {result && (
        <div className={`tester-result tester-result-${result.allowed ? 'allowed' : 'denied'}`}>
          <strong>{result.allowed ? 'Allowed' : 'Denied'}</strong>
          {durationMs !== null && <span className="tester-duration">{durationMs}ms</span>}
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      {error && (
        <div className="tester-result tester-result-error">
          <strong>
            {error.status || 'Network error'} {error.code}
          </strong>
          {durationMs !== null && <span className="tester-duration">{durationMs}ms</span>}
          <p>{error.message}</p>
        </div>
      )}
    </section>
  );
}
