import { defineConfig, devices } from '@playwright/test';

/**
 * JoyJoin E2E Test Configuration
 *
 * Prerequisites:
 *   npm run install:browsers   # one-time Chromium install
 *   npm run dev:server         # API on :5000
 *   npm run dev:user           # Web client on :5001 (optional for UI tests)
 *
 * Run:
 *   npm run test:e2e -w @joyjoin/e2e
 */

const BASE_API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000';
const BASE_WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5001';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'report' }]],
  use: {
    baseURL: BASE_WEB_URL,
    apiBaseURL: BASE_API_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: 'cd ../../apps/server && npm run dev',
          url: `${BASE_API_URL}/api/health`,
          timeout: 60_000,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: 'cd ../../apps/user-client && npm run dev',
          url: BASE_WEB_URL,
          timeout: 60_000,
          reuseExistingServer: !process.env.CI,
        },
      ],
});
