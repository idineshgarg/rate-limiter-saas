import { hashApiKey, type VerifyApiKey } from '@dg/rate-limiter-backend-auth';
import type { ApiKeysRepository } from '@dg/rate-limiter-backend-data-access';

export function createVerifyApiKey(
  apiKeysRepo: ApiKeysRepository,
  pepper: string,
): VerifyApiKey {
  return async (rawKey: string) => {
    const hashedKey = hashApiKey(rawKey, pepper);
    const apiKey = await apiKeysRepo.findActiveByHashedKey(hashedKey);
    if (!apiKey) {
      return null;
    }
    // Best-effort bookkeeping — must not add latency to the auth hot path.
    void apiKeysRepo.touchLastUsed(apiKey.id).catch(() => undefined);
    return { tenantId: apiKey.tenantId, apiKeyId: apiKey.id };
  };
}
