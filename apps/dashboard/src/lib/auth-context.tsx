import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from './api-client.js';
import type { Tenant } from './types.js';

interface AuthContextValue {
  tenant: Tenant | null;
  loading: boolean;
  signup: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .me()
      .then(setTenant)
      .catch(() => setTenant(null))
      .finally(() => setLoading(false));
  }, []);

  const value: AuthContextValue = {
    tenant,
    loading,
    signup: async (input) => setTenant(await apiClient.signup(input)),
    login: async (input) => setTenant(await apiClient.login(input)),
    logout: async () => {
      await apiClient.logout();
      setTenant(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
