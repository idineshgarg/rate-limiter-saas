import { useState } from 'react';
import { ApiError, apiClient } from '../lib/api-client.js';
import type { RateLimitRule, RuleUsage } from '../lib/types.js';

export function RuleUsageCell({ rule }: { rule: RateLimitRule }) {
  const [usage, setUsage] = useState<RuleUsage | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const needsIdentifier = rule.scope === 'IDENTIFIER';

  async function checkUsage() {
    setError(null);
    setChecking(true);
    try {
      setUsage(await apiClient.getRuleUsage(rule.id, needsIdentifier ? identifier : undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to check usage');
    } finally {
      setChecking(false);
    }
  }

  if (usage) {
    return (
      <span className="usage-value">
        {usage.remaining} / {usage.limit} remaining
        <button type="button" className="link-button" onClick={() => setUsage(null)}>
          refresh
        </button>
      </span>
    );
  }

  return (
    <span className="usage-check">
      {needsIdentifier && (
        <input
          className="usage-identifier-input"
          placeholder="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      )}
      <button
        type="button"
        onClick={checkUsage}
        disabled={checking || (needsIdentifier && !identifier.trim())}
      >
        {checking ? 'Checking…' : 'Check usage'}
      </button>
      {error && <span className="form-error usage-error">{error}</span>}
    </span>
  );
}
