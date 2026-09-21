import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcAlias = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@': srcAlias },
  },
  test: {
    projects: [
      {
        resolve: { alias: { '@': srcAlias } },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: { alias: { '@': srcAlias } },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          // ต้องคุยกับ Firebase จริง จึงให้เวลามากกว่า unit test
          testTimeout: 60_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
