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

  test('renders the Rail navigation', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible()
    await expect(page.getByRole('navigation').getByText('Hypermood')).toBeVisible()
  })

  test('shows user email in mono font at the bottom of the Rail', async ({ page }) => {
    const userEmail = process.env.TEST_USER_EMAIL ?? ''
    if (userEmail) {
      await expect(page.getByText(userEmail)).toBeVisible()
    }
  })

  test('shows a "New Roll" button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'New Roll' })).toBeVisible()
  })

  test('rolls are listed as rows, not cards — no rounded corners on rows', async ({ page }) => {
    // Roll rows should not have rounded class applied
    const rows = page.locator('a[href^="/rolls/"]')
    const count = await rows.count()
    if (count > 0) {
      const firstRow = rows.first()
      const classList = await firstRow.getAttribute('class')
      // The spec mandates rounded-none — no rounded corners on roll rows
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
    // URL should not change
    await expect(page).toHaveURL(/\/rolls$/)
    // Inline form should appear
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
    // Should show a validation error
    await expect(page.getByText(/name is required/i)).toBeVisible()
    // Should not navigate away
    await expect(page).toHaveURL(/\/rolls$/)
  })

  test('creating a roll with a valid name adds it to the list', async ({ page }) => {
    const rollName = `E2E Test Roll ${Date.now()}`
    await page.getByRole('button', { name: 'New Roll' }).click()
    await page.getByPlaceholder('Roll name').fill(rollName)
    await page.getByRole('button', { name: /create/i }).click()
    // Form should close
    await expect(page.getByPlaceholder('Roll name')).not.toBeVisible({ timeout: 5000 })
    // The new roll should appear in the list
    await expect(page.getByText(rollName)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Rail roll navigation', () => {
  test('clicking a roll in the Rail navigates to the command center', async ({ page }) => {
    await page.goto('/rolls')
    const railLinks = page.getByRole('navigation').getByRole('link').filter({ hasNot: page.getByText('Hypermood') })
    const count = await railLinks.count()
    if (count === 0) {
      test.skip()
      return
    }
    await railLinks.first().click()
    await expect(page).toHaveURL(/\/rolls\/.+/)
  })

  test('hovering a roll in the Rail shows a micro-preview', async ({ page }) => {
    await page.goto('/rolls')
    const railItems = page.getByRole('navigation').locator('li')
    const count = await railItems.count()
    if (count === 0) { test.skip(); return }

    await railItems.first().hover()
    // The micro-preview popup should appear
    await expect(railItems.first().locator('img, div.bg-primary-100').first())
      .toBeVisible({ timeout: 2000 })
  })

  test('Galleries button opens the gallery drawer', async ({ page }) => {
    await page.goto('/rolls')
    await page.getByRole('button', { name: 'Galleries' }).click()
    // Drawer should slide in
    await expect(page.getByRole('dialog', { name: /galleries/i })
      .or(page.getByText('Galleries').filter({ hasNot: page.getByRole('button') }))
    ).toBeVisible({ timeout: 3000 })
  })
})
