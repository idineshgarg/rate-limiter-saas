export { hashApiKey, generateApiKey } from './lib/api-key.js';
export {
  createApiKeyAuthMiddleware,
  type VerifyApiKey,
} from './lib/api-key-auth.middleware.js';
export { createAdminTokenAuthMiddleware } from './lib/admin-token-auth.middleware.js';
export { UnauthorizedError } from './lib/errors.js';
export type { AuthContext, GeneratedApiKey } from './lib/types.js';
