/**
 * Login page E2E tests.
 *
 * These run WITHOUT the auth storageState (no session) to test the unauthenticated flow.
 * They verify the dark-void design, OTP input behaviour, and error states.
 */

import { test, expect } from '@playwright/test'

// Override storageState for this entire file — we are testing the login page itself
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Login page — dark void design', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('renders the "Hypermood" title', async ({ page }) => {
    await expect(page.getByText('Hypermood')).toBeVisible()
  })

  test('has a dark background (primary-950)', async ({ page }) => {
    // primary-950 = #09090B = rgb(9, 9, 11)
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    )
    expect(bg).toBe('rgb(9, 9, 11)')
  })

  test('shows a single email input and no other form fields initially', async ({ page }) => {
    const inputs = page.locator('input')
    await expect(inputs).toHaveCount(1)
    await expect(inputs.first()).toHaveAttribute('type', 'email')
  })

  test('submit button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /send code|sign in/i })).toBeVisible()
  })
})

test.describe('Login page — email step', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('does not proceed on empty email', async ({ page }) => {
    await page.getByRole('button', { name: /send code|sign in/i }).click()
    // Should stay on the login page — no OTP boxes visible
    await expect(page.locator('input[maxlength="1"]')).not.toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('transitions to OTP step after valid email', async ({ page }) => {
    await page.getByRole('textbox').fill('test@example.com')
    await page.getByRole('button', { name: /send code|sign in/i }).click()
    // OTP boxes should appear (6 individual digit inputs)
    await expect(page.locator('input[maxlength="1"]').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('input[maxlength="1"]')).toHaveCount(6)
  })

  test('shows the submitted email in the OTP step', async ({ page }) => {
    const email = 'testuser@example.com'
    await page.getByRole('textbox').fill(email)
    await page.getByRole('button', { name: /send code|sign in/i }).click()
    await expect(page.getByText(email)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Login page — OTP input behaviour', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox').fill('test@example.com')
    await page.getByRole('button', { name: /send code|sign in/i }).click()
    // Wait for OTP boxes
    await expect(page.locator('input[maxlength="1"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('there are exactly 6 digit boxes', async ({ page }) => {
    await expect(page.locator('input[maxlength="1"]')).toHaveCount(6)
  })

  test('typing a digit advances focus to the next box', async ({ page }) => {
    const boxes = page.locator('input[maxlength="1"]')
    await boxes.nth(0).focus()
    await page.keyboard.type('1')
    // After typing, focus should move to the second box
    await expect(boxes.nth(1)).toBeFocused()
  })

  test('Backspace retreats focus to the previous box', async ({ page }) => {
    const boxes = page.locator('input[maxlength="1"]')
    await boxes.nth(0).fill('1')
    await boxes.nth(1).focus()
    await page.keyboard.press('Backspace')
    await expect(boxes.nth(0)).toBeFocused()
  })

  test('paste fills all 6 boxes at once', async ({ page }) => {
    const boxes = page.locator('input[maxlength="1"]')
    await boxes.nth(0).focus()
    // Simulate a clipboard paste of a 6-digit code
    await page.keyboard.insertText('123456')
    // All boxes should now have values
    for (let i = 0; i < 6; i++) {
      await expect(boxes.nth(i)).not.toHaveValue('')
    }
  })

  test('"Use a different email" link resets to email step', async ({ page }) => {
    await page.getByRole('button', { name: /use a different email/i }).click()
    // Should return to single email input
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[maxlength="1"]')).not.toBeVisible()
  })

  test('invalid OTP shows error state on all boxes', async ({ page }) => {
    const boxes = page.locator('input[maxlength="1"]')
    // Fill 6 digits that will fail
    for (let i = 0; i < 6; i++) {
      await boxes.nth(i).fill('9')
    }
    // Auto-submits — error state should appear
    await expect(page.locator('[class*="semantic-alert"], [class*="border-semantic-alert"]').first())
      .toBeVisible({ timeout: 5000 })
  })
})

test.describe('Route protection', () => {
  test('unauthenticated user visiting /rolls is redirected to login or unauthorized', async ({ page }) => {
    await page.goto('/rolls')
    // Should NOT render the authenticated rolls page
    await expect(page).not.toHaveURL(/\/rolls$/)
  })

  test('unauthenticated user visiting a roll page is redirected', async ({ page }) => {
    await page.goto('/rolls/fake-roll-id')
    await expect(page).not.toHaveURL(/\/rolls\/fake-roll-id/)
  })
})
