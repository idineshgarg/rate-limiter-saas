import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// The workspace-wide .env lives at the repo root, not next to this config,
// so it must be loaded explicitly regardless of the CLI's working directory.
loadEnv({ path: path.resolve(dirname, '../../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
