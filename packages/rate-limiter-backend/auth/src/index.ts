export { hashApiKey, generateApiKey } from './lib/api-key.js';
export {
  createApiKeyAuthMiddleware,
  type VerifyApiKey,
} from './lib/api-key-auth.middleware.js';
export { createAdminTokenAuthMiddleware } from './lib/admin-token-auth.middleware.js';
export { hashPassword, verifyPassword } from './lib/password.js';
export { signSessionToken, verifySessionToken, type SessionContext } from './lib/session.js';
export {
  createSessionAuthMiddleware,
  SESSION_COOKIE_NAME,
  type VerifySessionToken,
} from './lib/session-auth.middleware.js';
export { UnauthorizedError, ConflictError } from './lib/errors.js';
export type { AuthContext, GeneratedApiKey } from './lib/types.js';
