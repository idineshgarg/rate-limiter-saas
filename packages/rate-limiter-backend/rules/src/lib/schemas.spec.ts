import { describe, expect, it } from 'vitest';
import { checkRequestSchema, createRuleSchema, updateRuleSchema } from './schemas.js';

describe('createRuleSchema', () => {
  it('accepts a valid FIXED_WINDOW rule', () => {
    const result = createRuleSchema.safeParse({
      resource: 'checkout-api',
      algorithm: 'FIXED_WINDOW',
      limit: 100,
      windowMs: 60_000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects FIXED_WINDOW without windowMs', () => {
    const result = createRuleSchema.safeParse({
      resource: 'checkout-api',
      algorithm: 'FIXED_WINDOW',
      limit: 100,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid TOKEN_BUCKET rule without an explicit capacity', () => {
    const result = createRuleSchema.safeParse({
      resource: 'checkout-api',
      algorithm: 'TOKEN_BUCKET',
      limit: 50,
      refillRatePerMs: 0.01,
    });
    expect(result.success).toBe(true);
  });

  it('rejects TOKEN_BUCKET without refillRatePerMs', () => {
    const result = createRuleSchema.safeParse({
      resource: 'checkout-api',
      algorithm: 'TOKEN_BUCKET',
      limit: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown algorithm', () => {
    const result = createRuleSchema.safeParse({
      resource: 'checkout-api',
      algorithm: 'NOT_REAL',
      limit: 50,
    });
    expect(result.success).toBe(false);
  });

  it('defaults scope to API_KEY when omitted', () => {
    const result = createRuleSchema.parse({
      resource: 'checkout-api',
      algorithm: 'FIXED_WINDOW',
      limit: 100,
      windowMs: 60_000,
    });
    expect(result.scope).toBe('API_KEY');
  });
});

describe('updateRuleSchema', () => {
  it('accepts a partial update', () => {
    const result = updateRuleSchema.safeParse({ limit: 200 });
    expect(result.success).toBe(true);
  });

  it('accepts an empty object (no-op update)', () => {
    const result = updateRuleSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects an unrelated field like algorithm', () => {
    const result = updateRuleSchema.safeParse({ algorithm: 'TOKEN_BUCKET' });
    // unrecognized keys are stripped by default zod object parsing, not rejected —
    // this asserts the parsed value never carries `algorithm` through.
    expect(result.success && 'algorithm' in result.data).toBe(false);
  });
});

describe('checkRequestSchema', () => {
  it('defaults cost to 1', () => {
    const result = checkRequestSchema.parse({ resource: 'checkout-api' });
    expect(result.cost).toBe(1);
  });

  it('accepts an explicit identifier', () => {
    const result = checkRequestSchema.parse({
      resource: 'checkout-api',
      identifier: 'user_123',
    });
    expect(result.identifier).toBe('user_123');
  });

  it('rejects a missing resource', () => {
    const result = checkRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
