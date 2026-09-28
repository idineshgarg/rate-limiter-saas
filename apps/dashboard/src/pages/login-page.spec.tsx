import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api-client.js';
import { AuthProvider } from '../lib/auth-context.js';
import { LoginPage } from './login-page.js';

const { meMock, loginMock } = vi.hoisted(() => ({
  meMock: vi.fn(),
  loginMock: vi.fn(),
}));

vi.mock('../lib/api-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api-client.js')>();
  return { ...actual, apiClient: { me: meMock, login: loginMock } };
});

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    meMock.mockReset().mockRejectedValue(new Error('not signed in'));
    loginMock.mockReset();
  });

  it('shows the server-provided error message when login fails', async () => {
    loginMock.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Invalid email or password'));
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('calls apiClient.login with the entered credentials', async () => {
    loginMock.mockResolvedValue({ id: 't1', name: 'Jane', email: 'jane@example.com', createdAt: '' });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/password/i), 'the-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith({ email: 'jane@example.com', password: 'the-password' }),
    );
  });
});
