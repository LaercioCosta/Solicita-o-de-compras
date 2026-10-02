import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/generated/**'],
      reporter: ['text', 'text-summary', 'json'],
      reportsDirectory: './coverage',
    },
  },
});
