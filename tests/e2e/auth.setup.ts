/**
 * Playwright global setup: authenticates once and saves session to .auth/user.json.
 * All subsequent test files inherit this session via storageState in playwright.config.ts.
 *
 * Requires env vars:
 *   TEST_USER_EMAIL    — the test account email
 *
 * Because OTP is email-based, this setup uses Supabase's admin API to create a
 * magic link session directly, bypassing the email flow. Set
 * SUPABASE_SERVICE_ROLE_KEY in .env.test.local.
 *
 * Alternative: set TEST_OTP_CODE to a fixed code if your Supabase project has
 * OTP disabled and uses a fixed test code.
 */

import { test as setup, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup('authenticate as test user', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  if (!email) throw new Error('TEST_USER_EMAIL must be set in .env.test.local')

  // Navigate to the login page
  await page.goto('/login')

  // The login page is the dark void — verify we're on the right screen
  await expect(page.locator('text=Hypermood')).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', /rgb\(9,\s*9,\s*11\)/)

  // Submit email
  await page.getByRole('textbox').fill(email)
  await page.getByRole('button', { name: /send code|sign in/i }).click()

  // We expect the OTP code step to appear
  await expect(page.locator('[data-testid="otp-boxes"], input[maxlength="1"]').first()).toBeVisible({
    timeout: 5000,
  })

  // --- Option A: Read OTP from env (CI/test with magic link override) ---
  const testOtp = process.env.TEST_OTP_CODE
  if (testOtp) {
    // Type each digit into each box
    const boxes = page.locator('input[maxlength="1"]')
    for (let i = 0; i < testOtp.length; i++) {
      await boxes.nth(i).fill(testOtp[i])
    }
    // Auto-submits on fill — wait for redirect
    await page.waitForURL(/\/rolls/, { timeout: 10000 })
  } else {
    throw new Error(
      'TEST_OTP_CODE is not set. ' +
      'Set it in .env.test.local or implement a Supabase admin session creation strategy.',
    )
  }

  // Save session
  await page.context().storageState({ path: AUTH_FILE })
})
