import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context.js';

export function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { tenant, loading } = useAuth();

  if (loading) {
    return <p className="page-status">Loading…</p>;
  }
  if (!tenant) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
