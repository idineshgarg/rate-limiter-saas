import { useState, type FormEvent } from 'react';
import { ApiError, apiClient } from '../lib/api-client.js';
import type { ApiKeySummary } from '../lib/types.js';

interface Props {
  apiKeys: ApiKeySummary[];
  loading: boolean;
  onChange: () => Promise<void>;
}

export function ApiKeysPanel({ apiKeys, loading, onChange }: Props) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const created = await apiClient.createApiKey(name);
      setRevealedKey(created.key);
      setName('');
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm('Revoke this API key? Requests using it will stop working immediately.')) {
      return;
    }
    setError(null);
    try {
      await apiClient.revokeApiKey(id);
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke API key');
    }
  }

  return (
    <section className="panel">
      <h2>API Keys</h2>

      {revealedKey && (
        <div className="key-reveal">
          <p>Copy this key now — you won&apos;t be able to see it again:</p>
          <code>{revealedKey}</code>
          <button type="button" onClick={() => setRevealedKey(null)}>
            Dismiss
          </button>
        </div>
      )}

      <form className="inline-form" onSubmit={handleCreate}>
        <input
          placeholder="Key name (e.g. production)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="page-status">Loading…</p>
      ) : apiKeys.length === 0 ? (
        <p className="empty-state">No API keys yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Prefix</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {apiKeys.map((key) => (
              <tr key={key.id}>
                <td>{key.name}</td>
                <td>
                  <code>{key.prefix}…</code>
                </td>
                <td>
                  <span className={`status status-${key.status.toLowerCase()}`}>
                    {key.status}
                  </span>
                </td>
                <td>{new Date(key.createdAt).toLocaleDateString()}</td>
                <td>
                  {key.status === 'ACTIVE' && (
                    <button type="button" onClick={() => handleRevoke(key.id)}>
                      Revoke
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
