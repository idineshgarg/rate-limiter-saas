import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, apiClient } from '../lib/api-client.js';
import type { ApiKeySummary, CreateRuleInput, RateLimitAlgorithm, RateLimitRule } from '../lib/types.js';
import { RuleUsageCell } from './rule-usage-cell.js';

interface Props {
  apiKeys: ApiKeySummary[];
}

interface RuleFormState {
  apiKeyId: string;
  resource: string;
  algorithm: RateLimitAlgorithm;
  limit: number;
  windowMs: number;
  capacity: number;
  /** Entered per second in the form; converted to per-ms for the API. */
  refillRatePerSecond: number;
  /** Entered per second in the form; converted to per-ms for the API. */
  leakRatePerSecond: number;
}

const DEFAULT_FORM: RuleFormState = {
  apiKeyId: '',
  resource: '',
  algorithm: 'TOKEN_BUCKET',
  limit: 100,
  windowMs: 60_000,
  capacity: 100,
  refillRatePerSecond: 10,
  leakRatePerSecond: 10,
};

export function RulesPanel({ apiKeys }: Props) {
  const [rules, setRules] = useState<RateLimitRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormState>(DEFAULT_FORM);

  const activeKeys = apiKeys.filter((key) => key.status === 'ACTIVE');

  async function refresh() {
    setRules(await apiClient.listRules());
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const input: CreateRuleInput = {
        apiKeyId: form.apiKeyId,
        resource: form.resource,
        algorithm: form.algorithm,
        limit: form.limit,
      };
      if (form.algorithm === 'FIXED_WINDOW' || form.algorithm === 'SLIDING_WINDOW') {
        input.windowMs = form.windowMs;
      } else if (form.algorithm === 'LEAKY_BUCKET') {
        input.capacity = form.capacity;
        input.leakRatePerMs = form.leakRatePerSecond / 1000;
      } else if (form.algorithm === 'TOKEN_BUCKET') {
        input.capacity = form.capacity;
        input.refillRatePerMs = form.refillRatePerSecond / 1000;
      }

      await apiClient.createRule(input);
      setForm((f) => ({ ...DEFAULT_FORM, apiKeyId: f.apiKeyId }));
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create rule');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await apiClient.deleteRule(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete rule');
    }
  }

  return (
    <section className="panel">
      <h2>Rate Limit Rules</h2>

      {activeKeys.length === 0 ? (
        <p className="empty-state">Create an API key first to add rules.</p>
      ) : (
        <form className="rule-form" onSubmit={handleCreate}>
          <div className="form-row">
            <label>
              API key
              <select
                value={form.apiKeyId}
                onChange={(e) => setForm((f) => ({ ...f, apiKeyId: e.target.value }))}
                required
              >
                <option value="" disabled>
                  Select a key
                </option>
                {activeKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name} ({key.prefix}…)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Resource
              <input
                placeholder="e.g. checkout-api"
                value={form.resource}
                onChange={(e) => setForm((f) => ({ ...f, resource: e.target.value }))}
                required
              />
            </label>
            <label>
              Algorithm
              <select
                value={form.algorithm}
                onChange={(e) =>
                  setForm((f) => ({ ...f, algorithm: e.target.value as RateLimitAlgorithm }))
                }
              >
                <option value="TOKEN_BUCKET">Token bucket</option>
                <option value="LEAKY_BUCKET">Leaky bucket</option>
                <option value="FIXED_WINDOW">Fixed window</option>
                <option value="SLIDING_WINDOW">Sliding window</option>
              </select>
            </label>
            <label>
              Limit
              <input
                type="number"
                min={1}
                value={form.limit}
                onChange={(e) => setForm((f) => ({ ...f, limit: Number(e.target.value) }))}
                required
              />
            </label>
            {(form.algorithm === 'FIXED_WINDOW' || form.algorithm === 'SLIDING_WINDOW') && (
              <label>
                Window (ms)
                <input
                  type="number"
                  min={1}
                  value={form.windowMs}
                  onChange={(e) => setForm((f) => ({ ...f, windowMs: Number(e.target.value) }))}
                  required
                />
              </label>
            )}
            {form.algorithm === 'LEAKY_BUCKET' && (
              <>
                <label>
                  Capacity
                  <input
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                    required
                  />
                </label>
                <label>
                  Leak rate (units/sec)
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={form.leakRatePerSecond}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, leakRatePerSecond: Number(e.target.value) }))
                    }
                    required
                  />
                </label>
              </>
            )}
            {form.algorithm === 'TOKEN_BUCKET' && (
              <>
                <label>
                  Capacity
                  <input
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                    required
                  />
                </label>
                <label>
                  Refill rate (tokens/sec)
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={form.refillRatePerSecond}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, refillRatePerSecond: Number(e.target.value) }))
                    }
                    required
                  />
                </label>
              </>
            )}
          </div>
          <button type="submit" disabled={creating}>
            {creating ? 'Adding…' : 'Add rule'}
          </button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="page-status">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="empty-state">No rules yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Algorithm</th>
              <th>Limit</th>
              <th>Status</th>
              <th>Usage</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className={rule.isActive ? undefined : 'row-inactive'}>
                <td>{rule.resource}</td>
                <td>{rule.algorithm}</td>
                <td>{rule.limit}</td>
                <td>
                  <span className={`status status-${rule.isActive ? 'active' : 'inactive'}`}>
                    {rule.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <RuleUsageCell rule={rule} />
                </td>
                <td>
                  {rule.isActive && (
                    <button type="button" onClick={() => handleDelete(rule.id)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
