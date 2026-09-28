import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app.js';

vi.mock('../lib/api-client.js', () => ({
  apiClient: {
    me: vi.fn().mockRejectedValue(new Error('not signed in')),
  },
  ApiError: class ApiError extends Error {},
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('redirects an unauthenticated visitor from "/" to the login page', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument();
  });

  it('renders the signup page at /signup', async () => {
    renderAt('/signup');
    expect(await screen.findByRole('heading', { name: /create your account/i })).toBeInTheDocument();
  });
});
