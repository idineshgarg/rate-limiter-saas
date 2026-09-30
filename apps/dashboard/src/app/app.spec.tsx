import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app.js';

vi.mock('../lib/api-client.js', () => ({
  apiClient: {
    me: vi.fn().mockRejectedValue(new Error('not signed in')),
  },
  ApiError: class ApiError extends Error {},
  API_URL: 'http://localhost:3333',
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

  it('renders the docs page at /docs without requiring auth', async () => {
    renderAt('/docs');
    expect(await screen.findByRole('heading', { name: /api & sdk docs/i })).toBeInTheDocument();
  });
});
