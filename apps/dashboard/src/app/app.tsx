import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/protected-route.js';
import { AuthProvider } from '../lib/auth-context.js';
import { DashboardPage } from '../pages/dashboard-page.js';
import { LoginPage } from '../pages/login-page.js';
import { SignupPage } from '../pages/signup-page.js';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
