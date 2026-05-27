import { defineConfig, devices } from '@playwright/test'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Load secrets from .env.local first, then layer test-only pointers from
// .env.test.local on top. This keeps secrets in a single file — .env.test.local
// holds only the test account + seed-data IDs, no keys. (T-33)
function loadEnv(file: string) {
  const envPath = join(__dirname, file)
  if (!existsSync(envPath)) return
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

loadEnv('.env.local')
loadEnv('.env.test.local')

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
      // No artifacts from the setup project — it mints a real session, so a
      // trace/video/screenshot would capture live auth tokens. (T-33)
      use: {
        storageState: undefined,
        trace: 'off',
        video: 'off',
        screenshot: 'off',
      },
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
