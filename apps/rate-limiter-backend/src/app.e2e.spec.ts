import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import {
  ApiKeysRepository,
  RateLimitRulesRepository,
  TenantsRepository,
  createPrismaClient,
  type PrismaClient,
} from '@dg/rate-limiter-backend-data-access';
import { createRateLimiterEngine, createRedisClient } from '@dg/rate-limiter-backend-rate-limit-engine';
import { RuleService } from '@dg/rate-limiter-backend-rules';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dataAccessRoot = path.resolve(
  dirname,
  '../../../packages/rate-limiter-backend/data-access',
);

const ADMIN_TOKEN = 'test-admin-token';
const API_KEY_PEPPER = 'test-pepper';
const SESSION_SECRET = 'test-session-secret';

describe('rate-limiter-backend app (e2e)', () => {
  let pg: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let prisma: PrismaClient;
  let redis: Redis;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    pg = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('ratelimiter_e2e')
      .withUsername('ratelimiter')
      .withPassword('ratelimiter')
      .start();
    redisContainer = await new RedisContainer('redis:7-alpine').start();

    const databaseUrl = pg.getConnectionUri();
    execSync('npx prisma migrate deploy', {
      cwd: dataAccessRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });

    prisma = createPrismaClient(databaseUrl);
    redis = createRedisClient(redisContainer.getConnectionUrl());

    app = createApp({
      tenantsRepo: new TenantsRepository(prisma),
      apiKeysRepo: new ApiKeysRepository(prisma),
      ruleService: new RuleService(new RateLimitRulesRepository(prisma)),
      engine: createRateLimiterEngine(redis),
      adminToken: ADMIN_TOKEN,
      apiKeyPepper: API_KEY_PEPPER,
      sessionSecret: SESSION_SECRET,
      corsOrigin: 'http://localhost:4200',
    });
  });

  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
    await redisContainer.stop();
    await pg.stop();
  });

  async function createTenantAndKey(email: string) {
    const tenantRes = await request(app)
      .post('/v1/tenants')
      .set('X-Admin-Token', ADMIN_TOKEN)
      .send({ name: 'Acme', email });
    expect(tenantRes.status).toBe(201);

    const keyRes = await request(app)
      .post(`/v1/tenants/${tenantRes.body.id}/api-keys`)
      .set('X-Admin-Token', ADMIN_TOKEN)
      .send({ name: 'primary' });
    expect(keyRes.status).toBe(201);

    return { tenantId: tenantRes.body.id as string, apiKey: keyRes.body.key as string };
  }

  it('rejects bootstrap requests without a valid admin token', async () => {
    const res = await request(app)
      .post('/v1/tenants')
      .set('X-Admin-Token', 'wrong')
      .send({ name: 'x', email: 'x@x.com' });
    expect(res.status).toBe(401);
  });

  it('rejects rule/enforcement requests without a valid API key', async () => {
    const res = await request(app).post('/v1/rate-limit/check').send({ resource: 'x' });
    expect(res.status).toBe(401);
  });

  it('creates a tenant + API key, then a rule, then enforces it end to end', async () => {
    const { apiKey } = await createTenantAndKey('e2e-fixed@example.com');

    const ruleRes = await request(app)
      .post('/v1/rules')
      .set('X-Api-Key', apiKey)
      .send({
        resource: 'checkout-api',
        algorithm: 'FIXED_WINDOW',
        limit: 3,
        windowMs: 60_000,
      });
    expect(ruleRes.status).toBe(201);

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/v1/rate-limit/check')
        .set('X-Api-Key', apiKey)
        .send({ resource: 'checkout-api' });
      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
      expect(res.headers['x-ratelimit-remaining']).toBe(String(2 - i));
    }

    const denied = await request(app)
      .post('/v1/rate-limit/check')
      .set('X-Api-Key', apiKey)
      .send({ resource: 'checkout-api' });
    expect(denied.status).toBe(429);
    expect(denied.body.allowed).toBe(false);
    expect(Number(denied.headers['retry-after'])).toBeGreaterThanOrEqual(0);
  });

  it('returns 404 when no rule is configured for the requested resource', async () => {
    const { apiKey } = await createTenantAndKey('e2e-missing-rule@example.com');
    const res = await request(app)
      .post('/v1/rate-limit/check')
      .set('X-Api-Key', apiKey)
      .send({ resource: 'does-not-exist' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RULE_NOT_FOUND');
  });

  it('requires an identifier for IDENTIFIER-scoped rules', async () => {
    const { apiKey } = await createTenantAndKey('e2e-identifier@example.com');
    await request(app)
      .post('/v1/rules')
      .set('X-Api-Key', apiKey)
      .send({
        resource: 'per-user-api',
        algorithm: 'TOKEN_BUCKET',
        scope: 'IDENTIFIER',
        limit: 2,
        refillRatePerMs: 0.001,
      })
      .expect(201);

    const missingIdentifier = await request(app)
      .post('/v1/rate-limit/check')
      .set('X-Api-Key', apiKey)
      .send({ resource: 'per-user-api' });
    expect(missingIdentifier.status).toBe(400);

    const withIdentifier = await request(app)
      .post('/v1/rate-limit/check')
      .set('X-Api-Key', apiKey)
      .send({ resource: 'per-user-api', identifier: 'user_42' });
    expect(withIdentifier.status).toBe(200);
  });

  it('enforces LEAKY_BUCKET and SLIDING_WINDOW rules too', async () => {
    const { apiKey } = await createTenantAndKey('e2e-other-algos@example.com');

    await request(app)
      .post('/v1/rules')
      .set('X-Api-Key', apiKey)
      .send({
        resource: 'leaky-resource',
        algorithm: 'LEAKY_BUCKET',
        limit: 2,
        capacity: 2,
        leakRatePerMs: 0.001,
      })
      .expect(201);

    await request(app)
      .post('/v1/rules')
      .set('X-Api-Key', apiKey)
      .send({
        resource: 'sliding-resource',
        algorithm: 'SLIDING_WINDOW',
        limit: 2,
        windowMs: 60_000,
      })
      .expect(201);

    for (const resource of ['leaky-resource', 'sliding-resource']) {
      await request(app)
        .post('/v1/rate-limit/check')
        .set('X-Api-Key', apiKey)
        .send({ resource })
        .expect(200);
      await request(app)
        .post('/v1/rate-limit/check')
        .set('X-Api-Key', apiKey)
        .send({ resource })
        .expect(200);
      const denied = await request(app)
        .post('/v1/rate-limit/check')
        .set('X-Api-Key', apiKey)
        .send({ resource });
      expect(denied.status).toBe(429);
    }
  });

  it('lists, updates and deactivates rules for the authenticated tenant', async () => {
    const { apiKey } = await createTenantAndKey('e2e-crud@example.com');

    const created = await request(app)
      .post('/v1/rules')
      .set('X-Api-Key', apiKey)
      .send({ resource: 'crud-resource', algorithm: 'FIXED_WINDOW', limit: 5, windowMs: 1000 })
      .expect(201);

    const list = await request(app).get('/v1/rules').set('X-Api-Key', apiKey);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const updated = await request(app)
      .patch(`/v1/rules/${created.body.id}`)
      .set('X-Api-Key', apiKey)
      .send({ limit: 10 });
    expect(updated.status).toBe(200);
    expect(updated.body.limit).toBe(10);

    await request(app).delete(`/v1/rules/${created.body.id}`).set('X-Api-Key', apiKey).expect(204);

    const afterDelete = await request(app)
      .get(`/v1/rules/${created.body.id}`)
      .set('X-Api-Key', apiKey);
    expect(afterDelete.body.isActive).toBe(false);
  });

  describe('self-service signup/login (dashboard)', () => {
    it('signs up, exposes the session via /me, and rejects duplicate emails', async () => {
      const agent = request.agent(app);

      const signupRes = await agent
        .post('/v1/auth/signup')
        .send({ name: 'Jane', email: 'jane@example.com', password: 'correct-horse-battery' });
      expect(signupRes.status).toBe(201);
      expect(signupRes.body.email).toBe('jane@example.com');
      expect(signupRes.body.passwordHash).toBeUndefined();
      expect(signupRes.headers['set-cookie']?.[0]).toMatch(/rl_session=/);

      const meRes = await agent.get('/v1/auth/me');
      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe('jane@example.com');

      const dupRes = await request(app)
        .post('/v1/auth/signup')
        .send({ name: 'Jane Again', email: 'jane@example.com', password: 'another-password' });
      expect(dupRes.status).toBe(409);
    });

    it('rejects signup with a short password', async () => {
      const res = await request(app)
        .post('/v1/auth/signup')
        .send({ name: 'Short', email: 'short@example.com', password: 'abc' });
      expect(res.status).toBe(400);
    });

    it('logs in with correct credentials and rejects incorrect ones', async () => {
      await request(app)
        .post('/v1/auth/signup')
        .send({ name: 'Login User', email: 'login@example.com', password: 'the-right-password' });

      const badLogin = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'login@example.com', password: 'wrong-password' });
      expect(badLogin.status).toBe(401);

      const goodLogin = request.agent(app);
      const res = await goodLogin
        .post('/v1/auth/login')
        .send({ email: 'login@example.com', password: 'the-right-password' });
      expect(res.status).toBe(200);

      const meRes = await goodLogin.get('/v1/auth/me');
      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe('login@example.com');
    });

    it('rejects /me without a session, and clears the session on logout', async () => {
      await request(app).get('/v1/auth/me').expect(401);

      const agent = request.agent(app);
      await agent
        .post('/v1/auth/signup')
        .send({ name: 'Logout User', email: 'logout@example.com', password: 'a-fine-password' });
      await agent.get('/v1/auth/me').expect(200);

      await agent.post('/v1/auth/logout').expect(204);
      await agent.get('/v1/auth/me').expect(401);
    });
  });

  describe('self-service account management (dashboard)', () => {
    async function signUp(email: string) {
      const agent = request.agent(app);
      await agent
        .post('/v1/auth/signup')
        .send({ name: 'Dashboard User', email, password: 'a-strong-password' });
      return agent;
    }

    it('creates, lists, and revokes API keys for the signed-in tenant only', async () => {
      const agent = await signUp('keys-owner@example.com');
      const otherAgent = await signUp('keys-other@example.com');

      const createRes = await agent.post('/v1/account/api-keys').send({ name: 'my-key' });
      expect(createRes.status).toBe(201);
      expect(createRes.body.key).toMatch(/^rlk_/);
      expect(createRes.body.status).toBe('ACTIVE');

      const listRes = await agent.get('/v1/account/api-keys');
      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].key).toBeUndefined();

      const otherListRes = await otherAgent.get('/v1/account/api-keys');
      expect(otherListRes.body).toHaveLength(0);

      const revokeByOther = await otherAgent.delete(`/v1/account/api-keys/${createRes.body.id}`);
      expect(revokeByOther.status).toBe(401);

      const revoke = await agent.delete(`/v1/account/api-keys/${createRes.body.id}`);
      expect(revoke.status).toBe(204);
    });

    it('manages rules by session, enforcing apiKeyId ownership on create', async () => {
      const agent = await signUp('rules-owner@example.com');
      const otherAgent = await signUp('rules-other@example.com');

      const keyRes = await agent.post('/v1/account/api-keys').send({ name: 'primary' });
      const otherKeyRes = await otherAgent.post('/v1/account/api-keys').send({ name: 'primary' });

      const rejected = await agent.post('/v1/account/rules').send({
        apiKeyId: otherKeyRes.body.id,
        resource: 'checkout-api',
        algorithm: 'FIXED_WINDOW',
        limit: 5,
        windowMs: 1000,
      });
      expect(rejected.status).toBe(401);

      const created = await agent.post('/v1/account/rules').send({
        apiKeyId: keyRes.body.id,
        resource: 'checkout-api',
        algorithm: 'FIXED_WINDOW',
        limit: 5,
        windowMs: 1000,
      });
      expect(created.status).toBe(201);

      const list = await agent.get('/v1/account/rules');
      expect(list.body).toHaveLength(1);

      const updated = await agent
        .patch(`/v1/account/rules/${created.body.id}`)
        .send({ limit: 20 });
      expect(updated.body.limit).toBe(20);

      await agent.delete(`/v1/account/rules/${created.body.id}`).expect(204);
    });

    it('reports usage via peek without consuming a request itself', async () => {
      const agent = await signUp('usage-owner@example.com');
      const keyRes = await agent.post('/v1/account/api-keys').send({ name: 'primary' });
      const rawKey = keyRes.body.key as string;

      const ruleRes = await agent.post('/v1/account/rules').send({
        apiKeyId: keyRes.body.id,
        resource: 'usage-api',
        algorithm: 'FIXED_WINDOW',
        limit: 5,
        windowMs: 60_000,
      });

      const initialUsage = await agent.get(`/v1/account/rules/${ruleRes.body.id}/usage`);
      expect(initialUsage.status).toBe(200);
      expect(initialUsage.body).toEqual({ limit: 5, remaining: 5, resetMs: 0 });

      // Peeking must not itself count as a request.
      await agent.get(`/v1/account/rules/${ruleRes.body.id}/usage`);
      const stillFull = await agent.get(`/v1/account/rules/${ruleRes.body.id}/usage`);
      expect(stillFull.body.remaining).toBe(5);

      await request(app)
        .post('/v1/rate-limit/check')
        .set('X-Api-Key', rawKey)
        .send({ resource: 'usage-api' });
      await request(app)
        .post('/v1/rate-limit/check')
        .set('X-Api-Key', rawKey)
        .send({ resource: 'usage-api' });

      const afterTwo = await agent.get(`/v1/account/rules/${ruleRes.body.id}/usage`);
      expect(afterTwo.body.remaining).toBe(3);
    });

    it('requires an identifier query param when checking usage for an IDENTIFIER-scoped rule', async () => {
      const agent = await signUp('usage-identifier-owner@example.com');
      const keyRes = await agent.post('/v1/account/api-keys').send({ name: 'primary' });

      const ruleRes = await agent.post('/v1/account/rules').send({
        apiKeyId: keyRes.body.id,
        resource: 'usage-per-user',
        algorithm: 'TOKEN_BUCKET',
        scope: 'IDENTIFIER',
        limit: 3,
        refillRatePerMs: 0.001,
      });

      const missing = await agent.get(`/v1/account/rules/${ruleRes.body.id}/usage`);
      expect(missing.status).toBe(400);

      const withIdentifier = await agent.get(
        `/v1/account/rules/${ruleRes.body.id}/usage?identifier=user_42`,
      );
      expect(withIdentifier.status).toBe(200);
      expect(withIdentifier.body).toEqual({ limit: 3, remaining: 3, resetMs: 0 });
    });
  });
});
