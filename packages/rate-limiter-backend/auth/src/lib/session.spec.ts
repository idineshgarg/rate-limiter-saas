import { describe, expect, it } from 'vitest';
import { signSessionToken, verifySessionToken } from './session.js';

describe('signSessionToken / verifySessionToken', () => {
  it('round-trips a valid session', () => {
    const token = signSessionToken({ tenantId: 't1' }, 'secret');
    expect(verifySessionToken(token, 'secret')).toEqual({ tenantId: 't1' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = signSessionToken({ tenantId: 't1' }, 'secret-a');
    expect(verifySessionToken(token, 'secret-b')).toBeNull();
  });

  it('rejects a garbage token', () => {
    expect(verifySessionToken('not-a-jwt', 'secret')).toBeNull();
  });
});
