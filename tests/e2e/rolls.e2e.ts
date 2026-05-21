/**
 * Roll list and roll creation E2E tests.
 * Assumes a valid auth session from auth.setup.ts.
 */

import { test, expect } from '@playwright/test'

test.describe('Roll list page (/rolls)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rolls')
    await page.waitForLoadState('networkidle')
  })

  test('renders the top-bar with Hypermood wordmark', async ({ page }) => {
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hypermood' })).toBeVisible()
  })

  test('top-bar shows the Rolls breadcrumb', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Rolls')
  })

  test('top-bar exposes the cmd-k switcher trigger', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open switcher' })).toBeVisible()
  })

  test('settings popover reveals user email and Sign out', async ({ page }) => {
    await page.getByRole('button', { name: 'Hypermood' }).click()
    const userEmail = process.env.TEST_USER_EMAIL ?? ''
    if (userEmail) {
      await expect(page.getByRole('menu').getByText(userEmail)).toBeVisible()
    }
    await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
  })

  test('shows a "New Roll" button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'New Roll' })).toBeVisible()
  })

  test('rolls are listed as rows, not cards — no rounded corners on rows', async ({ page }) => {
    const rows = page.locator('main a[href^="/rolls/"]')
    const count = await rows.count()
    if (count > 0) {
      const firstRow = rows.first()
      const classList = await firstRow.getAttribute('class')
      expect(classList).not.toMatch(/\brounded-[^n]/)
    }
  })
})

test.describe('New Roll creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rolls')
  })

  test('clicking "New Roll" reveals inline form (no modal, no route change)', async ({ page }) => {
    await page.getByRole('button', { name: 'New Roll' }).click()
    await expect(page).toHaveURL(/\/rolls$/)
    await expect(page.getByPlaceholder('Roll name')).toBeVisible()
  })

  test('Cancel hides the form and shows the "New Roll" button again', async ({ page }) => {
    await page.getByRole('button', { name: 'New Roll' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'New Roll' })).toBeVisible()
    await expect(page.getByPlaceholder('Roll name')).not.toBeVisible()
  })

  test('submitting with an empty name shows an error', async ({ page }) => {
    await page.getByRole('button', { name: 'New Roll' }).click()
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByText(/name is required/i)).toBeVisible()
    await expect(page).toHaveURL(/\/rolls$/)
  })

  test('creating a roll with a valid name adds it to the list', async ({ page }) => {
    const rollName = `E2E Test Roll ${Date.now()}`
    await page.getByRole('button', { name: 'New Roll' }).click()
    await page.getByPlaceholder('Roll name').fill(rollName)
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByPlaceholder('Roll name')).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText(rollName)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Cmd-K switcher', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rolls')
    await page.waitForLoadState('networkidle')
  })

  test('opens via the trigger button and shows a search input', async ({ page }) => {
    await page.getByRole('button', { name: 'Open switcher' }).click()
    await expect(page.getByRole('dialog', { name: 'Switcher' })).toBeVisible()
    await expect(page.getByPlaceholder('Jump to roll or gallery…')).toBeFocused()
  })

  test('opens via Cmd+K / Ctrl+K and closes via Escape', async ({ page }) => {
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+k' : 'Control+k')
    await expect(page.getByRole('dialog', { name: 'Switcher' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Switcher' })).not.toBeVisible()
  })

  test('clicking a roll in the switcher navigates to the command center', async ({ page }) => {
    await page.getByRole('button', { name: 'Open switcher' }).click()
    const rollLink = page.getByRole('dialog', { name: 'Switcher' })
      .locator('button[data-idx]')
      .first()
    if ((await rollLink.count()) === 0) {
      test.skip()
      return
    }
    await rollLink.click()
    await expect(page).toHaveURL(/\/rolls\/.+/)
  })
})

test.describe('Galleries entry point', () => {
  test('Galleries is reachable from the settings popover', async ({ page }) => {
    await page.goto('/rolls')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Hypermood' }).click()
    await page.getByRole('menuitem', { name: 'Galleries' }).click()
    await expect(page.locator('.fixed.inset-y-0.right-0')).toBeVisible({ timeout: 3000 })
  })
})
