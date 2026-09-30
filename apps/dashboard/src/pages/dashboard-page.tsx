import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiKeysPanel } from '../components/api-keys-panel.js';
import { RulesPanel } from '../components/rules-panel.js';
import { apiClient } from '../lib/api-client.js';
import { useAuth } from '../lib/auth-context.js';
import type { ApiKeySummary } from '../lib/types.js';

export function DashboardPage() {
  const { tenant, logout } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);

  const refreshKeys = useCallback(async () => {
    setApiKeys(await apiClient.listApiKeys());
  }, []);

  useEffect(() => {
    refreshKeys().finally(() => setKeysLoading(false));
  }, [refreshKeys]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Rate Limiter</h1>
          <p>
            {tenant?.name} · {tenant?.email}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <Link to="/docs">Docs</Link>
          <button type="button" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </header>
      <main className="dashboard-main">
        <ApiKeysPanel apiKeys={apiKeys} loading={keysLoading} onChange={refreshKeys} />
        <RulesPanel apiKeys={apiKeys} />
      </main>
    </div>
  );
}
