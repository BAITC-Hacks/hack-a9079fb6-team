import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('..', import.meta.url)) } },
  test: { include: ['benchmarks/**/*.bench.test.ts'], environment: 'node',
    testTimeout: 600_000, hookTimeout: 600_000, maxWorkers: 1, fileParallelism: false },
});
