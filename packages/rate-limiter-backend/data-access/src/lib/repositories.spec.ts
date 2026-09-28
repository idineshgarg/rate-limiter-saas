import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiKeysRepository } from './api-keys.repository.js';
import { createPrismaClient, type PrismaClient } from './client.js';
import { RateLimitRulesRepository } from './rate-limit-rules.repository.js';
import { TenantsRepository } from './tenants.repository.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const libRoot = path.resolve(dirname, '../..');

describe('data-access repositories', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let tenants: TenantsRepository;
  let apiKeys: ApiKeysRepository;
  let rules: RateLimitRulesRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('ratelimiter_test')
      .withUsername('ratelimiter')
      .withPassword('ratelimiter')
      .start();

    const databaseUrl = container.getConnectionUri();
    // Applies the schema to the ephemeral container before any test runs.
    execSync('npx prisma migrate deploy', {
      cwd: libRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });

    prisma = createPrismaClient(databaseUrl);
    tenants = new TenantsRepository(prisma);
    apiKeys = new ApiKeysRepository(prisma);
    rules = new RateLimitRulesRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
  });

  it('creates a tenant and enforces unique email', async () => {
    const tenant = await tenants.create({ name: 'Acme', email: 'acme@example.com' });
    expect(tenant.id).toBeTruthy();

    await expect(
      tenants.create({ name: 'Acme Duplicate', email: 'acme@example.com' }),
    ).rejects.toThrow();
  });

  it('creates an API key, finds it by hash, and revokes it', async () => {
    const tenant = await tenants.create({ name: 'Globex', email: 'globex@example.com' });
    const key = await apiKeys.create({
      tenantId: tenant.id,
      name: 'primary',
      keyPrefix: 'rlk_abcd',
      hashedKey: 'hash-1',
    });

    const found = await apiKeys.findActiveByHashedKey('hash-1');
    expect(found?.id).toBe(key.id);

    const revoked = await apiKeys.revoke(key.id);
    expect(revoked.status).toBe('REVOKED');
    expect(await apiKeys.findActiveByHashedKey('hash-1')).toBeNull();
  });

  it('enforces one active resolvable rule per (apiKeyId, resource)', async () => {
    const tenant = await tenants.create({ name: 'Initech', email: 'initech@example.com' });
    const key = await apiKeys.create({
      tenantId: tenant.id,
      name: 'primary',
      keyPrefix: 'rlk_efgh',
      hashedKey: 'hash-2',
    });

    const rule = await rules.create({
      tenantId: tenant.id,
      apiKeyId: key.id,
      resource: 'checkout-api',
      algorithm: 'FIXED_WINDOW',
      limit: 100,
      windowMs: 60_000,
    });

    const resolved = await rules.findActiveByApiKeyAndResource(key.id, 'checkout-api');
    expect(resolved?.id).toBe(rule.id);

    await expect(
      rules.create({
        tenantId: tenant.id,
        apiKeyId: key.id,
        resource: 'checkout-api',
        algorithm: 'TOKEN_BUCKET',
        limit: 10,
        refillRatePerMs: 0.01,
      }),
    ).rejects.toThrow();

    await rules.deactivate(rule.id);
    expect(await rules.findActiveByApiKeyAndResource(key.id, 'checkout-api')).toBeNull();
  });
});
