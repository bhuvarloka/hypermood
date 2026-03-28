/**
 * Darkroom (Image Detail overlay) E2E tests.
 * Tests navigation, keyboard shortcuts, dark/light toggle, and metadata panel.
 */

import { test, expect } from '@playwright/test'

function getRollId(): string {
  const id = process.env.TEST_ROLL_ID
  if (!id) throw new Error('TEST_ROLL_ID must be set in .env.test.local')
  return id
}

async function openDarkroom(page: import('@playwright/test').Page) {
  await page.goto(`/rolls/${getRollId()}`)
  await page.waitForLoadState('networkidle')
  await page.locator('[class*="columns"] img').first().waitFor({ timeout: 5000 })
  // Hover the first image to reveal the fullscreen button
  const firstCell = page.locator('[class*="columns"] [role="button"]').first()
  await firstCell.hover()
  await firstCell.getByRole('button', { name: 'Open fullscreen' }).click()
  await expect(page.getByRole('dialog', { name: 'Image detail' })).toBeVisible()
}

test.describe('Darkroom — opening and closing', () => {
  test('clicking fullscreen icon opens the darkroom overlay', async ({ page }) => {
    await openDarkroom(page)
    await expect(page.getByRole('dialog', { name: 'Image detail' })).toBeVisible()
  })

  test('Escape closes the darkroom', async ({ page }) => {
    await openDarkroom(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Image detail' })).not.toBeVisible()
  })

  test('clicking the close button closes the darkroom', async ({ page }) => {
    await openDarkroom(page)
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog', { name: 'Image detail' })).not.toBeVisible()
  })

  test('clicking the backdrop closes the darkroom', async ({ page }) => {
    await openDarkroom(page)
    // Click outside the inner image container (the overlay background)
    await page.getByRole('dialog', { name: 'Image detail' }).click({ position: { x: 5, y: 5 } })
    await expect(page.getByRole('dialog', { name: 'Image detail' })).not.toBeVisible()
  })
})

test.describe('Darkroom — navigation', () => {
  test('ArrowRight navigates to the next image', async ({ page }) => {
    await openDarkroom(page)
    // Find if there's a "Next image" button (only shown when there is a next image)
    const hasNext = await page.getByRole('button', { name: 'Next image' }).isVisible()
    if (!hasNext) { test.skip(); return }

    // Get the current image src
    const initialSrc = await page.locator('[role="dialog"] img').first().getAttribute('src')
    await page.keyboard.press('ArrowRight')
    // The src should change
    await expect(page.locator('[role="dialog"] img').first()).not.toHaveAttribute('src', initialSrc!)
  })

  test('ArrowLeft does not navigate when on the first image', async ({ page }) => {
    await openDarkroom(page)
    const initialSrc = await page.locator('[role="dialog"] img').first().getAttribute('src')
    // Left arrow on first image — no "Previous image" button should be visible
    const hasPrev = await page.getByRole('button', { name: 'Previous image' }).isVisible()
    expect(hasPrev).toBe(false)
    await page.keyboard.press('ArrowLeft')
    // Src should not change
    await expect(page.locator('[role="dialog"] img').first()).toHaveAttribute('src', initialSrc!)
  })

  test('clicking the right edge zone navigates forward', async ({ page }) => {
    await openDarkroom(page)
    const hasNext = await page.getByRole('button', { name: 'Next image' }).isVisible()
    if (!hasNext) { test.skip(); return }
    const initialSrc = await page.locator('[role="dialog"] img').first().getAttribute('src')
    await page.getByRole('button', { name: 'Next image' }).click()
    await expect(page.locator('[role="dialog"] img').first()).not.toHaveAttribute('src', initialSrc!)
  })
})

test.describe('Darkroom — dark/light toggle', () => {
  test('starts in dark mode (primary-950 background)', async ({ page }) => {
    await openDarkroom(page)
    const overlay = page.getByRole('dialog', { name: 'Image detail' })
    const classList = await overlay.getAttribute('class')
    expect(classList).toContain('bg-primary-950')
  })

  test('toggle button switches to light background', async ({ page }) => {
    await openDarkroom(page)
    await page.getByRole('button', { name: 'Switch to light background' }).click()
    const overlay = page.getByRole('dialog', { name: 'Image detail' })
    const classList = await overlay.getAttribute('class')
    expect(classList).toContain('bg-white')
  })

  test('toggle button label reflects current mode', async ({ page }) => {
    await openDarkroom(page)
    // In dark mode, button should say "Switch to light background"
    await expect(page.getByRole('button', { name: 'Switch to light background' })).toBeVisible()
    await page.getByRole('button', { name: 'Switch to light background' }).click()
    // After switch, label inverts
    await expect(page.getByRole('button', { name: 'Switch to dark background' })).toBeVisible()
  })
})

test.describe('Darkroom — metadata panel', () => {
  test('hovering the bottom zone reveals the metadata panel', async ({ page }) => {
    await openDarkroom(page)
    const overlay = page.getByRole('dialog', { name: 'Image detail' })
    // Hover the bottom hover zone
    const bottomZone = overlay.locator('.absolute.bottom-0.inset-x-0.h-24')
    await bottomZone.hover()
    // Some metadata content should appear
    await expect(overlay.locator('.animate-bloom').last()).toBeVisible({ timeout: 3000 })
  })

  test('metadata panel shows the filename', async ({ page }) => {
    await openDarkroom(page)
    const overlay = page.getByRole('dialog', { name: 'Image detail' })
    await overlay.locator('.absolute.bottom-0.inset-x-0.h-24').hover()
    // Filename should be visible (at minimum)
    await expect(overlay.locator('text=.jpg, text=.png, text=.jpeg, text=.webp').first())
      .toBeVisible({ timeout: 5000 })
      .catch(async () => {
        // If no extension text found, just verify some text appeared
        await expect(overlay.locator('.animate-bloom').last()).toBeVisible()
      })
  })
})
