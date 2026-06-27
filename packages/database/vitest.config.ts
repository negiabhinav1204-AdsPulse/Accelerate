import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'scripts/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: [
      {
        find: /^@workspace\/common\/(.*)/,
        replacement: path.resolve(__dirname, '../common/src/$1.ts'),
      },
    ],
  },
});
