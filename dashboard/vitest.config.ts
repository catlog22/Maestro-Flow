import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', '../src/**/*.test.ts'],
    exclude: ['src/server/execution/execution-scheduler.test.ts'],
    environment: 'node',
  },
});
