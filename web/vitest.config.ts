import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    environment: 'node',
    // Playwright specs under tests/e2e run separately via test:e2e.
    include: ['{app,components,hooks,lib}/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.{ts,tsx}'],
      exclude: ['lib/**/*.test.{ts,tsx}'],
      reporter: ['text-summary', 'json-summary', 'lcov'],
      thresholds: { lines: 90, statements: 90, branches: 85, functions: 90 },
    },
  },
});
