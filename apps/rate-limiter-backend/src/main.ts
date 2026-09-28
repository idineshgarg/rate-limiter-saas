import 'dotenv/config';
import { createApp } from './app.js';
import { createRedisClient, createRateLimiterEngine } from '@dg/rate-limiter-backend-rate-limit-engine';
import {
  ApiKeysRepository,
  RateLimitRulesRepository,
  TenantsRepository,
  createPrismaClient,
} from '@dg/rate-limiter-backend-data-access';
import { RuleService } from '@dg/rate-limiter-backend-rules';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3333;

const prisma = createPrismaClient(requireEnv('DATABASE_URL'));
const redis = createRedisClient(requireEnv('REDIS_URL'));

const app = createApp({
  tenantsRepo: new TenantsRepository(prisma),
  apiKeysRepo: new ApiKeysRepository(prisma),
  ruleService: new RuleService(new RateLimitRulesRepository(prisma)),
  engine: createRateLimiterEngine(redis),
  adminToken: requireEnv('ADMIN_TOKEN'),
  apiKeyPepper: requireEnv('API_KEY_HASH_PEPPER'),
  sessionSecret: requireEnv('SESSION_SECRET'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
