import { createHmac, randomBytes } from 'node:crypto';
import type { GeneratedApiKey } from './types.js';

const KEY_PREFIX = 'rlk_';
const PREFIX_DISPLAY_LENGTH = 12;

/**
 * API keys are high-entropy random tokens, not user-chosen passwords — an
 * HMAC (fast, keyed) is the right tool here, not a slow adaptive hash like
 * bcrypt/argon2, which would only add latency to the hot enforcement path
 * without any security benefit against a token with this much entropy.
 */
export function hashApiKey(rawKey: string, pepper: string): string {
  return createHmac('sha256', pepper).update(rawKey).digest('hex');
}

export function generateApiKey(): GeneratedApiKey {
  const raw = `${KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
  return { raw, prefix: raw.slice(0, PREFIX_DISPLAY_LENGTH) };
}
