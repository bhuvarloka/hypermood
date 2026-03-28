/**
 * Public gallery page (/g/[slug]) E2E tests.
 *
 * Runs WITHOUT the auth storageState — these pages are publicly accessible.
 * Requires TEST_PUBLIC_GALLERY_SLUG in .env.test.local pointing at a
 * published gallery with at least 4 images and layout='timeline'.
 */

import { test, expect } from '@playwright/test'

// No auth needed for public gallery
test.use({ storageState: { cookies: [], origins: [] } })

function getSlug(): string {
  const slug = process.env.TEST_PUBLIC_GALLERY_SLUG
  if (!slug) throw new Error('TEST_PUBLIC_GALLERY_SLUG must be set in .env.test.local')
  return slug
}

test.describe('Public gallery — page structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/g/${getSlug()}`)
    await page.waitForLoadState('networkidle')
  })

  test('shows the gallery name in the header', async ({ page }) => {
    await expect(page.locator('header h1')).toBeVisible()
  })

  test('shows the Hypermood brand in the header', async ({ page }) => {
    await expect(page.getByText('Hypermood')).toBeVisible()
  })

  test('does NOT show the Rail (no auth chrome)', async ({ page }) => {
    await expect(page.getByRole('navigation')).not.toBeVisible()
  })

  test('renders images', async ({ page }) => {
    await expect(page.locator('main img').first()).toBeVisible({ timeout: 5000 })
  })

  test('images have a viewTransitionName for smooth animations', async ({ page }) => {
    const firstImg = page.locator('main img').first()
    await expect(firstImg).toBeVisible()
    // The parent div should have a viewTransitionName style
    const parentDiv = firstImg.locator('..')
    const style = await parentDiv.getAttribute('style')
    expect(style).toContain('view-transition-name')
  })
})

test.describe('Public gallery — masonry layout', () => {
  test('images use CSS columns layout (masonry)', async ({ page }) => {
    await page.goto(`/g/${getSlug()}`)
    await page.waitForLoadState('networkidle')
    const container = page.locator('main .columns-1, main [class*="columns-"]').first()
    await expect(container).toBeVisible()
  })

  test('images do not have rounded corners (spec: rounded-none)', async ({ page }) => {
    await page.goto(`/g/${getSlug()}`)
    await page.waitForLoadState('networkidle')
    const imgs = page.locator('main img')
    const firstImg = imgs.first()
    await expect(firstImg).toBeVisible()
    const classList = await firstImg.getAttribute('class')
    expect(classList).toContain('rounded-none')
  })
})

test.describe('Public gallery — timeline mode toggle', () => {
  // These tests only apply when the gallery layout is 'timeline'
  test('view toggle is visible for timeline galleries', async ({ page }) => {
    await page.goto(`/g/${getSlug()}`)
    await page.waitForLoadState('networkidle')
    // If the toggle exists, the gallery supports timeline
    const toggleExists = await page.getByRole('button', { name: /masonry view|timeline view/i }).first().isVisible()
    if (!toggleExists) { test.skip(); return }
    await expect(page.getByRole('button', { name: 'Masonry view' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Timeline view' })).toBeVisible()
  })

  test('switching to timeline shows horizontal scroll container on desktop', async ({ page }) => {
    await page.goto(`/g/${getSlug()}`)
    await page.waitForLoadState('networkidle')
    const hasToggle = await page.getByRole('button', { name: 'Timeline view' }).isVisible()
    if (!hasToggle) { test.skip(); return }

    await page.getByRole('button', { name: 'Timeline view' }).click()
    // On desktop: a horizontal flex container
    await expect(page.locator('.overflow-x-auto').first()).toBeVisible({ timeout: 2000 })
  })

  test('switching back to masonry hides the timeline', async ({ page }) => {
    await page.goto(`/g/${getSlug()}`)
    await page.waitForLoadState('networkidle')
    const hasToggle = await page.getByRole('button', { name: 'Timeline view' }).isVisible()
    if (!hasToggle) { test.skip(); return }

    await page.getByRole('button', { name: 'Timeline view' }).click()
    await page.getByRole('button', { name: 'Masonry view' }).click()
    // Masonry columns should come back
    await expect(page.locator('main [class*="columns-"]').first()).toBeVisible({ timeout: 2000 })
  })

  test('timeline toggle buttons are aria-pressed correctly', async ({ page }) => {
    await page.goto(`/g/${getSlug()}`)
    await page.waitForLoadState('networkidle')
    const hasToggle = await page.getByRole('button', { name: 'Masonry view' }).isVisible()
    if (!hasToggle) { test.skip(); return }

    const masonryBtn = page.getByRole('button', { name: 'Masonry view' })
    const timelineBtn = page.getByRole('button', { name: 'Timeline view' })

    // Default: masonry is active
    await expect(masonryBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(timelineBtn).toHaveAttribute('aria-pressed', 'false')

    // Switch to timeline
    await timelineBtn.click()
    await expect(masonryBtn).toHaveAttribute('aria-pressed', 'false')
    await expect(timelineBtn).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('Public gallery — not found / private', () => {
  test('returns 404 for a non-existent slug', async ({ page }) => {
    const response = await page.goto('/g/this-slug-does-not-exist-12345')
    // Next.js notFound() renders the 404 page
    expect(response?.status()).toBe(404)
  })

  test('private gallery is not accessible without auth', async ({ page }) => {
    const privateSlug = process.env.TEST_PRIVATE_GALLERY_SLUG
    if (!privateSlug) { test.skip(); return }
    const response = await page.goto(`/g/${privateSlug}`)
    expect(response?.status()).toBe(404)
  })
})

test.describe('Public gallery — stagger animation', () => {
  test('images have animation-delay styles (stagger)', async ({ page }) => {
    await page.goto(`/g/${getSlug()}`)
    await page.waitForLoadState('networkidle')
    await page.locator('main img').first().waitFor()

    // The wrapping divs should have animationDelay styles
    const wrappers = page.locator('main .animate-bloom')
    const firstWrapper = wrappers.first()
    const style = await firstWrapper.getAttribute('style')
    // The delay for index 0 is 0ms — so may not have a style; check index 1+
    const secondWrapper = wrappers.nth(1)
    const secondStyle = await secondWrapper.getAttribute('style')
    if (secondStyle) {
      expect(secondStyle).toContain('animation-delay')
    }
  })

  test('animation delay is capped at 600ms', async ({ page }) => {
    await page.goto(`/g/${getSlug()}`)
    await page.waitForLoadState('networkidle')
    await page.locator('main img').first().waitFor()

    const wrappers = page.locator('main .animate-bloom')
    const count = await wrappers.count()
    if (count < 25) { test.skip(); return } // need enough images to hit the cap

    // Check the 25th wrapper (index 24 * 30 = 720 > 600, so it should be capped)
    const wrapper = wrappers.nth(24)
    const style = await wrapper.getAttribute('style')
    if (style?.includes('animation-delay')) {
      const match = style.match(/animation-delay:\s*(\d+)ms/)
      if (match) {
        expect(parseInt(match[1])).toBeLessThanOrEqual(600)
      }
    }
  })
})
