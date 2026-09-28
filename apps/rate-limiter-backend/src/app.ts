import { createVerifyApiKey } from './lib/verify-api-key.js';
import { errorHandler } from './middleware/error-handler.js';
import { createAdminRouter } from './routes/admin.routes.js';
import { createRateLimitRouter } from './routes/rate-limit.routes.js';
import { createRulesRouter } from './routes/rules.routes.js';
import type { RateLimiterEngine } from '@org/rate-limiter-backend-rate-limit-engine';
import type {
  ApiKeysRepository,
  TenantsRepository,
} from '@org/rate-limiter-backend-data-access';
import type { RuleService } from '@org/rate-limiter-backend-rules';
import express, { type Express } from 'express';

export interface AppDeps {
  tenantsRepo: TenantsRepository;
  apiKeysRepo: ApiKeysRepository;
  ruleService: RuleService;
  engine: RateLimiterEngine;
  adminToken: string;
  apiKeyPepper: string;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  const verifyApiKey = createVerifyApiKey(deps.apiKeysRepo, deps.apiKeyPepper);

  app.use(express.json());

  // CORS configuration for React app
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, X-Api-Key, X-Admin-Token',
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.get('/', (req, res) => {
    res.send({ message: 'Hello API' });
  });

  // --- Rate-limiter SaaS API ---
  //
  // The more specific /v1/rules and /v1/rate-limit routers must be mounted
  // before the broader /v1 admin router: the admin router's auth middleware
  // is unconditional router-level `.use()`, so it would otherwise intercept
  // every /v1/* request (erroring via next(err), never falling through) —
  // including ones meant for these other two routers — since Express tries
  // mounted routers in registration order by path prefix.

  app.use(
    '/v1/rules',
    createRulesRouter({ ruleService: deps.ruleService, verifyApiKey }),
  );

  app.use(
    '/v1/rate-limit',
    createRateLimitRouter({
      ruleService: deps.ruleService,
      engine: deps.engine,
      verifyApiKey,
    }),
  );

  app.use(
    '/v1',
    createAdminRouter({
      tenantsRepo: deps.tenantsRepo,
      apiKeysRepo: deps.apiKeysRepo,
      adminToken: deps.adminToken,
      apiKeyPepper: deps.apiKeyPepper,
    }),
  );

  app.use(errorHandler);

  return app;
}
