import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Config combinada (TASK-047): roda unit (*.spec.ts) + e2e (*.e2e-spec.ts) numa
// ÚNICA execução para medir a cobertura somada das duas suites sobre src/.
// Serializado (fileParallelism: false) porque os testes e2e compartilham o banco.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
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
