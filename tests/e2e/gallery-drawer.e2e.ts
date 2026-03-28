/**
 * Gallery Drawer E2E tests.
 * Tests list/detail views, edit, drag-to-reorder, and remove.
 * Requires at least one gallery in the test account.
 */

import { test, expect } from '@playwright/test'

async function openGalleryDrawer(page: import('@playwright/test').Page) {
  await page.goto('/rolls')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Galleries' }).click()
  // Wait for drawer to animate in
  await page.waitForTimeout(300)
}

test.describe('Gallery Drawer — list view', () => {
  test.beforeEach(async ({ page }) => {
    await openGalleryDrawer(page)
  })

  test('drawer opens from the Rail "Galleries" button', async ({ page }) => {
    await expect(page.locator('.fixed.inset-y-0.right-0')).toBeVisible()
  })

  test('drawer can be closed with Escape', async ({ page }) => {
    await page.keyboard.press('Escape')
    await expect(page.locator('.fixed.inset-y-0.right-0')).not.toBeVisible()
  })

  test('drawer can be closed by clicking the backdrop', async ({ page }) => {
    await page.locator('.fixed.inset-0.z-40').click({ position: { x: 10, y: 10 } })
    await expect(page.locator('.fixed.inset-y-0.right-0')).not.toBeVisible()
  })

  test('drawer can be closed with the × button', async ({ page }) => {
    await page.getByRole('button', { name: 'Close galleries' }).click()
    await expect(page.locator('.fixed.inset-y-0.right-0')).not.toBeVisible()
  })

  test('shows "No galleries yet." when the list is empty', async ({ page }) => {
    // This only passes if the test account has no galleries
    // It documents the empty state behaviour — skip if there are galleries
    const hasGalleries = await page.locator('ul li').first().isVisible().catch(() => false)
    if (hasGalleries) { test.skip(); return }
    await expect(page.getByText('No galleries yet.')).toBeVisible()
  })

  test('each gallery row shows the name, image count, and public/private badge', async ({ page }) => {
    const rows = page.locator('ul li')
    const count = await rows.count()
    if (count === 0) { test.skip(); return }

    const firstRow = rows.first()
    // Name should be visible
    await expect(firstRow.locator('p.text-lg')).toBeVisible()
    // Count in mono font
    await expect(firstRow.locator('p.font-mono')).toContainText(/\d+ image/)
    // public or private badge
    await expect(firstRow.locator('p.font-mono')).toContainText(/public|private/)
  })

  test('gallery row shows a 2×2 thumbnail mosaic', async ({ page }) => {
    const rows = page.locator('ul li')
    if (await rows.count() === 0) { test.skip(); return }
    // The mosaic is a 2x2 grid
    await expect(rows.first().locator('.grid-cols-2')).toBeVisible()
  })
})

test.describe('Gallery Drawer — detail view', () => {
  test.beforeEach(async ({ page }) => {
    await openGalleryDrawer(page)
    const rows = page.locator('ul li')
    const count = await rows.count()
    if (count === 0) { test.skip(); return }
    await rows.first().click()
    await page.waitForTimeout(300)
  })

  test('navigates to detail view when a gallery row is clicked', async ({ page }) => {
    await expect(page.getByRole('button', { name: '← back' })).toBeVisible()
  })

  test('"← back" button returns to the list view', async ({ page }) => {
    await page.getByRole('button', { name: '← back' }).click()
    await expect(page.locator('span.text-lg.font-medium', { hasText: 'Galleries' })).toBeVisible()
  })

  test('detail view shows layout toggle (masonry / timeline)', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'masonry' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'timeline' })).toBeVisible()
  })

  test('detail view shows the public/private toggle', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /public|private/ })
    await expect(toggle).toBeVisible()
  })

  test('clicking the gallery name enters edit mode', async ({ page }) => {
    const nameButton = page.locator('button.text-xl.font-medium')
    await nameButton.click()
    await expect(page.locator('input.text-xl.font-medium')).toBeVisible()
  })

  test('cancelling the name edit (blur with no change) does not update', async ({ page }) => {
    const nameButton = page.locator('button.text-xl.font-medium')
    const originalName = await nameButton.textContent()
    await nameButton.click()
    const input = page.locator('input.text-xl.font-medium')
    // Clear and refill with same name
    await input.fill(originalName!.trim())
    await input.blur()
    // Name should remain unchanged
    await expect(page.locator('button.text-xl.font-medium')).toHaveText(originalName!.trim())
  })

  test('removing an image from the gallery decreases the count', async ({ page }) => {
    const imageGrid = page.locator('.grid-cols-3')
    if (!await imageGrid.isVisible()) { test.skip(); return }

    const initialCount = await imageGrid.locator('> div').count()
    if (initialCount === 0) { test.skip(); return }

    // Hover first image to reveal remove button
    const firstThumb = imageGrid.locator('> div').first()
    await firstThumb.hover()
    await firstThumb.getByRole('button', { name: 'Remove image' }).click()
    // Count should decrease
    await expect(imageGrid.locator('> div')).toHaveCount(initialCount - 1, { timeout: 5000 })
  })
})

test.describe('Gallery Drawer — opened from chat intent', () => {
  test('typing "show my galleries" in chat opens the drawer', async ({ page }) => {
    const rollId = process.env.TEST_ROLL_ID
    if (!rollId) { test.skip(); return }

    await page.goto(`/rolls/${rollId}`)
    await page.waitForLoadState('networkidle')
    const textarea = page.getByPlaceholder('Ask about this roll…')
    await textarea.fill('show my galleries')
    await textarea.press('Enter')
    // Gallery drawer should open
    await expect(page.locator('.fixed.inset-y-0.right-0')).toBeVisible({ timeout: 3000 })
    // No AI processing should have happened — no "Interpreting query" line
    await expect(page.getByText('Interpreting query...')).not.toBeVisible()
  })
})
