import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: [resolve(__dirname, 'src/**/*.test.ts')],
    environment: 'node',
    root: resolve(__dirname),
  },
});
