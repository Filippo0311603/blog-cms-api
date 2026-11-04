import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    setupFiles: ['test/setup.ts'],
    // Starting mongod the first time can be slow (binary download).
    hookTimeout: 180_000,
    testTimeout: 20_000,
  },
});
