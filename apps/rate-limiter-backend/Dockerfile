# syntax=docker/dockerfile:1

# --- deps + build -----------------------------------------------------------
# Builds the whole workspace so Nx can resolve internal package deps, then
# prunes down to a self-contained deploy folder (apps/rate-limiter-backend/dist)
# containing the esbuild bundle, a minimal package.json, and a lockfile
# scoped to only the runtime deps the bundle actually needs.
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci
# `prisma generate` (run as part of the build) only needs DATABASE_URL to be
# *set*, not reachable — it never connects to the database. The real URL is
# injected at container start for the runtime/migrate stages.
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/db
RUN npx nx run @dg/rate-limiter-backend:prune

# --- migrate -----------------------------------------------------------------
# One-off image for `prisma migrate deploy`. Needs the full workspace (Prisma
# CLI + schema live in devDependencies, which the pruned runtime image above
# deliberately excludes), so it's built from the `build` stage rather than
# the runtime one.
FROM build AS migrate
WORKDIR /app/packages/rate-limiter-backend/data-access
CMD ["npx", "prisma", "migrate", "deploy"]

# --- runtime -----------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/apps/rate-limiter-backend/dist ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

ENV HOST=0.0.0.0
ENV PORT=3333
EXPOSE 3333

CMD ["node", "main.js"]
