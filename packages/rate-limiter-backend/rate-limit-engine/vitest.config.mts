import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir:
    '../../../node_modules/.vite/packages/rate-limiter-backend/rate-limit-engine',
  test: {
    name: '@org/rate-limiter-backend-rate-limit-engine',
    watch: false,
    globals: true,
    environment: 'node',
    // Container startup (first pull especially) can take a while.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
