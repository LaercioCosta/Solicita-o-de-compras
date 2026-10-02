import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
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
