# Rate Limiter SaaS

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

A distributed rate-limiter SaaS backend, built as an Nx/npm-workspaces monorepo.

## 📦 Project Overview

- **App**

  - `apps/rate-limiter-backend` - Express API implementing the rate-limiter SaaS

- **Libraries** (`packages/rate-limiter-backend/`)

  - `rate-limit-engine` - Redis-backed algorithm engine (Lua-script atomic operations)
  - `data-access` - Prisma schema/client + repositories (Tenant, ApiKey, RateLimitRule)
  - `auth` - API-key hashing + Express auth middleware
  - `rules` - Rate-limit rule CRUD + validation

## 🛡️ Rate Limiter SaaS Backend

`apps/rate-limiter-backend` implements a multi-tenant distributed rate limiter with four
selectable algorithms — fixed window, sliding window, leaky bucket, and token bucket —
enforced against Redis, with tenant/API-key/rule metadata stored in Postgres via Prisma.

### Local setup

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Copy env vars and fill in any secrets
cp .env.example .env

# 3. Apply the database schema
npm exec nx run @org/rate-limiter-backend-data-access:prisma-migrate

# 4. Start the API
npm exec nx serve rate-limiter-backend
```

The API listens on `http://localhost:3333` by default. Bootstrap a tenant and API key with
the `X-Admin-Token` from `.env`, then create rules and call the enforcement endpoint:

```bash
# Create a tenant
curl -X POST http://localhost:3333/v1/tenants \
  -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Acme","email":"acme@example.com"}'

# Create an API key for that tenant (returns the raw key once)
curl -X POST http://localhost:3333/v1/tenants/<tenantId>/api-keys \
  -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"primary"}'

# Create a rule
curl -X POST http://localhost:3333/v1/rules \
  -H "X-Api-Key: <rawKey>" -H "Content-Type: application/json" \
  -d '{"resource":"checkout-api","algorithm":"TOKEN_BUCKET","limit":10,"refillRatePerMs":0.01}'

# Enforce it
curl -X POST http://localhost:3333/v1/rate-limit/check \
  -H "X-Api-Key: <rawKey>" -H "Content-Type: application/json" \
  -d '{"resource":"checkout-api"}'
```

### Testing

Most suites need Docker (they spin up ephemeral Redis/Postgres via testcontainers):

```bash
npm exec nx run-many -t test
```

## 🚀 Quick Start

```bash
# Clone the repository
git clone <your-fork-url>
cd <your-repository-name>

# Install dependencies
npm install

# Serve the API
npx nx serve rate-limiter-backend

# Build all projects
npx nx run-many -t build

# Run tests
npx nx run-many -t test

# Lint all projects
npx nx run-many -t lint

# Visualize the project graph
npx nx graph
```

## 🔒 Module Boundaries

Projects are tagged `scope:rate-limiter-backend` and enforce architectural constraints via
`@nx/enforce-module-boundaries` — see `eslint.config.mjs`.

```bash
# See the current project graph and boundaries
npx nx graph

# View a specific project's details
npx nx show project @org/rate-limiter-backend --web
```

[Learn more about module boundaries →](https://nx.dev/docs/features/enforce-module-boundaries)

## 📁 Project Structure

```
├── apps/
│   └── rate-limiter-backend/   [scope:rate-limiter-backend] - Express API
├── packages/
│   └── rate-limiter-backend/
│       ├── rate-limit-engine/  [scope:rate-limiter-backend] - Redis algorithm engine
│       ├── data-access/        [scope:rate-limiter-backend] - Prisma schema + repositories
│       ├── auth/                [scope:rate-limiter-backend] - API-key auth
│       └── rules/                [scope:rate-limiter-backend] - Rule CRUD + validation
├── docker-compose.yml    - Local Postgres + Redis
├── nx.json               - Nx configuration
├── tsconfig.json         - TypeScript configuration
└── eslint.config.mjs     - ESLint with module boundary rules
```

## 📚 Useful Commands

```bash
# Project exploration
npx nx graph                                              # Interactive dependency graph
npx nx list                                               # List installed plugins
npx nx show project @org/rate-limiter-backend --web       # View project details

# Development
npx nx serve rate-limiter-backend                         # Serve the API
npx nx run @org/rate-limiter-backend:build                # Build the API

# Running multiple tasks
npx nx run-many -t build                       # Build all projects
npx nx run-many -t test --parallel=3          # Test in parallel
npx nx run-many -t lint test build            # Run multiple targets

# Affected commands (great for CI)
npx nx affected -t build                       # Build only affected projects
npx nx affected -t test                        # Test only affected projects
```

## 🎯 Adding New Features

### Generate a new Node library:

```bash
npx nx g @nx/js:lib my-lib --directory=packages/rate-limiter-backend/my-lib
```

You can use `npx nx list` to see all available plugins and `npx nx list <plugin-name>` to see all generators for a specific plugin.

## Nx Cloud

Nx Cloud ensures a [fast and scalable CI](https://nx.dev/nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/docs/features/ci-features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/docs/features/ci-features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/docs/features/ci-features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/docs/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## 🔗 Learn More

- [Nx Documentation](https://nx.dev/docs)
- [Module Boundaries](https://nx.dev/docs/features/enforce-module-boundaries)
- [Docker Integration](https://nx.dev/docs/guides/nx-release/release-docker-images)
- [Nx Cloud](https://nx.dev/nx-cloud)
