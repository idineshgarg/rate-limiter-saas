import { describe, expect, it } from 'vitest';
import { generateApiKey, hashApiKey } from './api-key.js';

describe('generateApiKey', () => {
  it('produces a raw key with the expected prefix marker', () => {
    const { raw } = generateApiKey();
    expect(raw.startsWith('rlk_')).toBe(true);
  });

  it('produces a display prefix that is a substring of the raw key', () => {
    const { raw, prefix } = generateApiKey();
    expect(raw.startsWith(prefix)).toBe(true);
  });

  it('generates unique keys on each call', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
  });
});

describe('hashApiKey', () => {
  it('is deterministic for the same key and pepper', () => {
    const raw = 'rlk_abc123';
    expect(hashApiKey(raw, 'pepper')).toBe(hashApiKey(raw, 'pepper'));
  });

  it('produces different hashes for different peppers', () => {
    const raw = 'rlk_abc123';
    expect(hashApiKey(raw, 'pepper-a')).not.toBe(hashApiKey(raw, 'pepper-b'));
  });

  it('produces different hashes for different keys', () => {
    expect(hashApiKey('rlk_one', 'pepper')).not.toBe(hashApiKey('rlk_two', 'pepper'));
  });

  it('never leaks the raw key in the output', () => {
    const raw = 'rlk_super-secret-value';
    expect(hashApiKey(raw, 'pepper')).not.toContain(raw);
  });
});
