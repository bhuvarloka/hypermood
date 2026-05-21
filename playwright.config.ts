import { defineConfig, devices } from '@playwright/test'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const envPath = join(__dirname, '.env.test.local')
if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

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
