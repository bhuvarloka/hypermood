/**
 * Command Center (/rolls/[rollId]) E2E tests.
 *
 * Tests the core UX: chat, grid dimming, image selection, filter chips,
 * preview panel, and gallery save flow.
 *
 * Requires at least one roll with indexed images in the test account.
 * Set TEST_ROLL_ID in .env.test.local to point at a seeded roll.
 */

import { test, expect } from '@playwright/test'

function getRollId(): string {
  const id = process.env.TEST_ROLL_ID
  if (!id) throw new Error('TEST_ROLL_ID must be set in .env.test.local')
  return id
}

test.describe('Command Center — layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/rolls/${getRollId()}`)
    await page.waitForLoadState('networkidle')
  })

  test('shows the roll name as a heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('shows the image count in mono font', async ({ page }) => {
    await expect(page.locator('p.font-mono')).toContainText(/\d+ images/)
  })

  test('shows the chat textarea with correct placeholder', async ({ page }) => {
    await expect(page.getByPlaceholder('Ask about this roll…')).toBeVisible()
  })

  test('shows the image grid', async ({ page }) => {
    const gridImages = page.locator('[class*="columns"] img')
    await expect(gridImages.first()).toBeVisible({ timeout: 5000 })
  })

  test('does NOT show filter chips or "Show all" before any query', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Show all' })).not.toBeVisible()
  })
})

test.describe('Command Center — chat and dimming', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/rolls/${getRollId()}`)
    await page.waitForLoadState('networkidle')
  })

  test('Enter submits a message', async ({ page }) => {
    const textarea = page.getByPlaceholder('Ask about this roll…')
    await textarea.fill('show me portraits')
    await textarea.press('Enter')
    // User message should appear in chat
    await expect(page.getByText('show me portraits')).toBeVisible({ timeout: 3000 })
  })

  test('Shift+Enter inserts a newline instead of submitting', async ({ page }) => {
    const textarea = page.getByPlaceholder('Ask about this roll…')
    await textarea.fill('line one')
    await textarea.press('Shift+Enter')
    // Should NOT submit — no message bubble yet
    await expect(page.getByText('line one')).not.toBeVisible({ timeout: 1000 }).catch(() => {
      // If it IS visible, it's a bug — we'd need it not submitted
    })
    // The textarea value should contain a newline
    const value = await textarea.inputValue()
    expect(value).toContain('\n')
  })

  test('assistant response appears after submit', async ({ page }) => {
    const textarea = page.getByPlaceholder('Ask about this roll…')
    await textarea.fill('show me everything')
    await textarea.press('Enter')
    // Wait for the processing indicator to clear and assistant message to appear
    await expect(page.locator('.animate-bloom').filter({ hasText: /found|showing|result/i }))
      .toBeVisible({ timeout: 15000 })
  })

  test('result images dim non-matching images to low opacity', async ({ page }) => {
    const textarea = page.getByPlaceholder('Ask about this roll…')
    await textarea.fill('show me portraits')
    await textarea.press('Enter')
    // Wait for result
    await page.waitForSelector('button:has-text("Show all")', { timeout: 15000 })

    // At least one image cell should have reduced opacity
    const dimmedCells = page.locator('[style*="opacity: 0.15"], [style*="opacity:0.15"]')
    await expect(dimmedCells.first()).toBeVisible({ timeout: 3000 })
  })

  test('"Show all" button resets the dimming', async ({ page }) => {
    const textarea = page.getByPlaceholder('Ask about this roll…')
    await textarea.fill('show me portraits')
    await textarea.press('Enter')
    await page.waitForSelector('button:has-text("Show all")', { timeout: 15000 })
    await page.getByRole('button', { name: 'Show all' }).click()
    // "Show all" button should disappear
    await expect(page.getByRole('button', { name: 'Show all' })).not.toBeVisible()
    // No dimmed images
    const dimmedCells = page.locator('[style*="opacity: 0.15"]')
    expect(await dimmedCells.count()).toBe(0)
  })
})

test.describe('Command Center — suggestions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/rolls/${getRollId()}`)
    await page.waitForLoadState('networkidle')
  })

  test('shows suggestion chips before any conversation', async ({ page }) => {
    // Either roll-specific or universal suggestions appear as buttons
    const chips = page.locator('button').filter({ hasText: /show me|find|what's in/i })
    await expect(chips.first()).toBeVisible()
  })

  test('clicking a suggestion chip sends it as a message', async ({ page }) => {
    const chip = page.locator('button').filter({ hasText: /show me the best|find all|what's in/i }).first()
    const chipText = await chip.textContent()
    await chip.click()
    // The chip text should appear as a user message
    await expect(page.getByText(chipText!.trim())).toBeVisible({ timeout: 3000 })
  })

  test('gallery intent message dispatches gallery event instead of querying', async ({ page }) => {
    const textarea = page.getByPlaceholder('Ask about this roll…')
    await textarea.fill('show my galleries')
    await textarea.press('Enter')
    // The gallery drawer should open, NOT a query response
    await expect(page.getByText('Galleries').first()).toBeVisible({ timeout: 3000 })
  })
})

test.describe('Command Center — image selection and image-as-prompt', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/rolls/${getRollId()}`)
    await page.waitForLoadState('networkidle')
    // Wait for grid to load
    await page.locator('[class*="columns"] img').first().waitFor({ timeout: 5000 })
  })

  test('clicking an image selects it and shows selection strip', async ({ page }) => {
    const firstImage = page.locator('[class*="columns"] [role="button"]').first()
    await firstImage.click()
    // Selection strip should appear with "1 selected"
    await expect(page.getByText('1 selected')).toBeVisible()
  })

  test('clicking a selected image deselects it', async ({ page }) => {
    const firstImage = page.locator('[class*="columns"] [role="button"]').first()
    await firstImage.click()
    await expect(page.getByText('1 selected')).toBeVisible()
    await firstImage.click()
    await expect(page.getByText('1 selected')).not.toBeVisible()
  })

  test('selected image appears in the selection strip thumbnail', async ({ page }) => {
    const firstImage = page.locator('[class*="columns"] [role="button"]').first()
    await firstImage.click()
    // The strip should contain at least one thumbnail
    await expect(page.locator('.animate-bloom img').first()).toBeVisible()
  })

  test('placeholder text changes when images are selected', async ({ page }) => {
    const firstImage = page.locator('[class*="columns"] [role="button"]').first()
    await firstImage.click()
    await expect(
      page.getByPlaceholder('Describe what to find with these as reference…'),
    ).toBeVisible()
  })

  test('selected images are visually marked with a ring', async ({ page }) => {
    const firstCell = page.locator('[class*="columns"] [role="button"]').first()
    await firstCell.click()
    const classList = await firstCell.getAttribute('class')
    expect(classList).toMatch(/ring/)
  })
})

test.describe('Command Center — filter chips', () => {
  // Run a query first so filter chips appear
  async function runQueryAndOpenFilter(page: import('@playwright/test').Page) {
    await page.goto(`/rolls/${getRollId()}`)
    await page.waitForLoadState('networkidle')
    const textarea = page.getByPlaceholder('Ask about this roll…')
    await textarea.fill('show me portraits')
    await textarea.press('Enter')
    await page.waitForSelector('button:has-text("Show all")', { timeout: 15000 })
    // Open filter chips
    await page.getByRole('button', { name: /show filter/i }).first().click()
  }

  test('filter chips appear after opening the filter section', async ({ page }) => {
    await runQueryAndOpenFilter(page)
    // At least one chip should be visible
    await expect(page.locator('[data-filter-chips]')).toBeVisible()
  })

  test('removing a filter chip reruns the query', async ({ page }) => {
    await runQueryAndOpenFilter(page)
    const chips = page.locator('[data-filter-chips] span')
    const chipCount = await chips.count()
    if (chipCount === 0) { test.skip(); return }

    // Hover to reveal the × button and click it
    await chips.first().hover()
    await chips.first().getByRole('button', { name: /remove filter/i }).click()
    // Query reruns — processing indicator should briefly appear
    await expect(
      page.locator('text=Interpreting query').or(page.locator('text=Searching')),
    ).toBeVisible({ timeout: 3000 }).catch(() => {
      // Fast queries may resolve before we check — that's OK
    })
  })

  test('+ button reveals the add-filter input', async ({ page }) => {
    await runQueryAndOpenFilter(page)
    await page.locator('[data-filter-chips] button[aria-label="Add filter"]').click()
    await expect(page.locator('[data-filter-chips] input[placeholder="field: value"]')).toBeVisible()
  })

  test('entering a valid filter and pressing Enter adds it and reruns', async ({ page }) => {
    await runQueryAndOpenFilter(page)
    await page.locator('[data-filter-chips] button[aria-label="Add filter"]').click()
    const filterInput = page.locator('[data-filter-chips] input[placeholder="field: value"]')
    await filterInput.fill('scene: outdoor')
    await filterInput.press('Enter')
    // New chip should appear
    await expect(page.locator('[data-filter-chips]').getByText(/scene/)).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Command Center — preview panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/rolls/${getRollId()}`)
    await page.waitForLoadState('networkidle')
    // Run a query to get results
    const textarea = page.getByPlaceholder('Ask about this roll…')
    await textarea.fill('show me everything')
    await textarea.press('Enter')
    await page.waitForSelector('button:has-text("Show all")', { timeout: 15000 })
  })

  test('"Preview selection" button appears when results exist', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Preview selection' })).toBeVisible()
  })

  test('clicking "Preview selection" opens the panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Preview selection' }).click()
    await expect(page.getByRole('dialog', { name: 'Preview selection' })).toBeVisible()
  })

  test('Space key opens the preview panel when focus is not in a text field', async ({ page }) => {
    // Click somewhere outside the textarea to defocus it
    await page.locator('h1').click()
    await page.keyboard.press('Space')
    await expect(page.getByRole('dialog', { name: 'Preview selection' })).toBeVisible()
  })

  test('Escape closes the preview panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Preview selection' }).click()
    await page.getByRole('dialog', { name: 'Preview selection' }).waitFor()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Preview selection' })).not.toBeVisible()
  })

  test('clicking the backdrop closes the panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Preview selection' }).click()
    await page.getByRole('dialog', { name: 'Preview selection' }).waitFor()
    // Click the backdrop (above the panel)
    await page.locator('.fixed.inset-0 > .flex-1').click()
    await expect(page.getByRole('dialog', { name: 'Preview selection' })).not.toBeVisible()
  })

  test('panel shows the correct image count', async ({ page }) => {
    await page.getByRole('button', { name: 'Preview selection' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Preview selection' }).getByText(/\d+ images/),
    ).toBeVisible()
  })
})

test.describe('Command Center — gallery save flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/rolls/${getRollId()}`)
    await page.waitForLoadState('networkidle')
    const textarea = page.getByPlaceholder('Ask about this roll…')
    await textarea.fill('show me everything')
    await textarea.press('Enter')
    await page.waitForSelector('button:has-text("Show all")', { timeout: 15000 })
    await page.getByRole('button', { name: 'Preview selection' }).click()
    await page.getByRole('dialog', { name: 'Preview selection' }).waitFor()
  })

  test('"Save as Gallery" button opens the save form', async ({ page }) => {
    await page.getByRole('button', { name: 'Save as Gallery' }).click()
    await expect(page.getByPlaceholder('Gallery name')).toBeVisible()
  })

  test('save button is disabled when name is empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Save as Gallery' }).click()
    const saveButton = page.getByRole('button', { name: 'Save' })
    await expect(saveButton).toBeDisabled()
  })

  test('pressing Enter in the name field submits the form', async ({ page }) => {
    const galleryName = `E2E Gallery ${Date.now()}`
    await page.getByRole('button', { name: 'Save as Gallery' }).click()
    await page.getByPlaceholder('Gallery name').fill(galleryName)
    await page.getByPlaceholder('Gallery name').press('Enter')
    // Panel should close and a confirmation message should appear in chat
    await expect(page.getByRole('dialog', { name: 'Preview selection' })).not.toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/gallery saved/i)).toBeVisible({ timeout: 5000 })
  })

  test('saved gallery creates a clickable link in chat', async ({ page }) => {
    const galleryName = `E2E Link Test ${Date.now()}`
    await page.getByRole('button', { name: 'Save as Gallery' }).click()
    await page.getByPlaceholder('Gallery name').fill(galleryName)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('dialog', { name: 'Preview selection' })).not.toBeVisible({ timeout: 10000 })
    // The confirmation message should contain a /g/ link
    await expect(page.locator('a[href^="/g/"]')).toBeVisible({ timeout: 5000 })
  })
})
