import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests run against a live Next.js dev server.
 *
 * Prerequisites:
 *   - .env.test.local with TEST_USER_EMAIL and TEST_USER_PASSWORD
 *   - A seeded Supabase test project with at least one roll
 *
 * Run: pnpm test:e2e
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',

  // One test at a time — avoids race conditions on shared Supabase test data
  workers: 1,
  retries: 0,
  timeout: 30000,

  use: {
    baseURL: 'http://localhost:3000',
    // Store auth session so login only runs once in global setup
    storageState: 'tests/e2e/.auth/user.json',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    // Setup project: handles authentication before any test runs
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
      use: { storageState: undefined },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60000,
  },
})
