import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4110;
const WEB_PORT = 3110;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  // next dev compiles each route on first visit, which can take a few seconds.
  expect: { timeout: 10000 },
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  // Runs the real API (from ../api) next to the web app, so the WebSocket path is exercised end to end.
  webServer: [
    {
      command: `PORT=${API_PORT} CORS_ORIGINS=http://127.0.0.1:${WEB_PORT} bun run --cwd ../api src/index.ts`,
      url: `http://127.0.0.1:${API_PORT}/api/health/live`,
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:${API_PORT} npx next dev --port ${WEB_PORT}`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
