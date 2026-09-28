export interface AuthContext {
  tenantId: string;
  apiKeyId: string;
}

export interface GeneratedApiKey {
  /** The full raw key — shown to the caller exactly once, never persisted. */
  raw: string;
  /** First 8 chars of the raw key, safe to store/display for identification. */
  prefix: string;
}
