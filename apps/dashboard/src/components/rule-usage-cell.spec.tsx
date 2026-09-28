import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RateLimitRule } from '../lib/types.js';
import { RuleUsageCell } from './rule-usage-cell.js';

const { getRuleUsageMock } = vi.hoisted(() => ({ getRuleUsageMock: vi.fn() }));

vi.mock('../lib/api-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api-client.js')>();
  return { ...actual, apiClient: { getRuleUsage: getRuleUsageMock } };
});

function makeRule(overrides: Partial<RateLimitRule> = {}): RateLimitRule {
  return {
    id: 'rule-1',
    apiKeyId: 'key-1',
    resource: 'checkout-api',
    algorithm: 'FIXED_WINDOW',
    scope: 'API_KEY',
    limit: 5,
    windowMs: 60_000,
    capacity: null,
    refillRatePerMs: null,
    leakRatePerMs: null,
    isActive: true,
    createdAt: '',
    ...overrides,
  };
}

describe('RuleUsageCell', () => {
  beforeEach(() => {
    getRuleUsageMock.mockReset();
  });

  it('fetches and displays usage for an API_KEY-scoped rule without an identifier', async () => {
    getRuleUsageMock.mockResolvedValue({ limit: 5, remaining: 3, resetMs: 1000 });
    const user = userEvent.setup();
    render(<RuleUsageCell rule={makeRule()} />);

    await user.click(screen.getByRole('button', { name: /check usage/i }));

    expect(await screen.findByText('3 / 5 remaining')).toBeInTheDocument();
    expect(getRuleUsageMock).toHaveBeenCalledWith('rule-1', undefined);
  });

  it('requires an identifier before enabling the check for an IDENTIFIER-scoped rule', async () => {
    getRuleUsageMock.mockResolvedValue({ limit: 3, remaining: 2, resetMs: 500 });
    const user = userEvent.setup();
    render(<RuleUsageCell rule={makeRule({ scope: 'IDENTIFIER' })} />);

    const button = screen.getByRole('button', { name: /check usage/i });
    expect(button).toBeDisabled();

    await user.type(screen.getByPlaceholderText('identifier'), 'user_42');
    expect(button).toBeEnabled();

    await user.click(button);
    expect(getRuleUsageMock).toHaveBeenCalledWith('rule-1', 'user_42');
    expect(await screen.findByText('2 / 3 remaining')).toBeInTheDocument();
  });

  it('shows an error message when the usage check fails', async () => {
    const { ApiError } = await import('../lib/api-client.js');
    getRuleUsageMock.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'identifier required'));
    const user = userEvent.setup();
    render(<RuleUsageCell rule={makeRule()} />);

    await user.click(screen.getByRole('button', { name: /check usage/i }));

    expect(await screen.findByText('identifier required')).toBeInTheDocument();
  });
});
