import { createVerifyApiKey } from './lib/verify-api-key.js';
import { errorHandler } from './middleware/error-handler.js';
import { createAccountRouter } from './routes/account.routes.js';
import { createAdminRouter } from './routes/admin.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createDashboardRulesRouter } from './routes/dashboard-rules.routes.js';
import { createRateLimitRouter } from './routes/rate-limit.routes.js';
import { createRulesRouter } from './routes/rules.routes.js';
import type { RateLimiterEngine } from '@dg/rate-limiter-backend-rate-limit-engine';
import type {
  ApiKeysRepository,
  TenantsRepository,
} from '@dg/rate-limiter-backend-data-access';
import type { RuleService } from '@dg/rate-limiter-backend-rules';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';

export interface AppDeps {
  tenantsRepo: TenantsRepository;
  apiKeysRepo: ApiKeysRepository;
  ruleService: RuleService;
  engine: RateLimiterEngine;
  adminToken: string;
  apiKeyPepper: string;
  sessionSecret: string;
  /** Origin the dashboard frontend is served from — required for credentialed CORS requests. */
  corsOrigin: string;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  const verifyApiKey = createVerifyApiKey(deps.apiKeysRepo, deps.apiKeyPepper);

  app.use(express.json());
  app.use(cookieParser());

  // CORS configuration for the dashboard frontend. A credentialed request
  // (cookies) can't use the wildcard origin — the browser rejects that
  // combination — so this reflects the one configured frontend origin and
  // explicitly opts in to credentials.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', deps.corsOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
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
  // Every router mounted at a prefix more specific than the bare /v1 admin
  // router must come first: the admin router's auth middleware is
  // unconditional router-level `.use()`, so it would otherwise intercept
  // every /v1/* request (erroring via next(err), never falling through) —
  // including ones meant for these other routers — since Express tries
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

  app.use('/v1/auth', createAuthRouter({ tenantsRepo: deps.tenantsRepo, sessionSecret: deps.sessionSecret }));

  // /v1/account/rules is more specific than /v1/account below it and must be
  // mounted first, for the same reason as the admin router note above.
  app.use(
    '/v1/account/rules',
    createDashboardRulesRouter({
      ruleService: deps.ruleService,
      apiKeysRepo: deps.apiKeysRepo,
      engine: deps.engine,
      sessionSecret: deps.sessionSecret,
    }),
  );

  app.use(
    '/v1/account',
    createAccountRouter({
      apiKeysRepo: deps.apiKeysRepo,
      sessionSecret: deps.sessionSecret,
      apiKeyPepper: deps.apiKeyPepper,
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
