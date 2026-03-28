import { describe, it, expect } from 'vitest'
import { buildLines } from '@/components/chat/processing-indicator.logic'

describe('buildLines — text query mode (isImagePrompt=false)', () => {
  it('returns two base lines for a text query without matchCount', () => {
    const lines = buildLines({ isImagePrompt: false, imageCount: 100 })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('Interpreting query...')
    expect(lines[1]).toBe('Searching 100 images...')
  })

  it('formats imageCount with locale separators', () => {
    const lines = buildLines({ isImagePrompt: false, imageCount: 1234567 })
    // toLocaleString will insert separators — must not be the raw number
    expect(lines[1]).toContain('1,234,567')
  })

  it('appends match line when matchCount is 0', () => {
    const lines = buildLines({ isImagePrompt: false, imageCount: 50, matchCount: 0 })
    expect(lines).toHaveLength(3)
    expect(lines[2]).toBe('Found 0 matches')
  })

  it('appends "match" (singular) when matchCount is exactly 1', () => {
    const lines = buildLines({ isImagePrompt: false, imageCount: 50, matchCount: 1 })
    expect(lines[2]).toBe('Found 1 match')
  })

  it('appends "matches" (plural) when matchCount is 2', () => {
    const lines = buildLines({ isImagePrompt: false, imageCount: 50, matchCount: 2 })
    expect(lines[2]).toBe('Found 2 matches')
  })

  it('does NOT append match line when matchCount is undefined', () => {
    const lines = buildLines({ isImagePrompt: false, imageCount: 50, matchCount: undefined })
    expect(lines).toHaveLength(2)
  })
})

describe('buildLines — image-as-prompt mode (isImagePrompt=true)', () => {
  it('returns two different base lines for image prompt', () => {
    const lines = buildLines({ isImagePrompt: true, imageCount: 0 })
    expect(lines[0]).toBe('Computing visual similarity...')
    expect(lines[1]).toBe('Blending with text prompt...')
  })

  it('does NOT include imageCount in the base lines for image-prompt mode', () => {
    // imageCount is irrelevant for image-as-prompt — no "Searching N images" line
    const lines = buildLines({ isImagePrompt: true, imageCount: 999 })
    for (const line of lines) {
      expect(line).not.toContain('999')
    }
  })

  it('appends singular match line for image-prompt path', () => {
    const lines = buildLines({ isImagePrompt: true, imageCount: 0, matchCount: 1 })
    expect(lines[2]).toBe('Found 1 match')
  })

  it('appends plural match line for image-prompt path', () => {
    const lines = buildLines({ isImagePrompt: true, imageCount: 0, matchCount: 42 })
    expect(lines[2]).toBe('Found 42 matches')
  })
})

describe('buildLines — matchCount=0 edge case', () => {
  it('treats 0 as a defined matchCount (shows the terminal line)', () => {
    // A real 0-result query must show "Found 0 matches", not omit the line
    const withZero = buildLines({ isImagePrompt: false, imageCount: 10, matchCount: 0 })
    const withUndefined = buildLines({ isImagePrompt: false, imageCount: 10 })
    expect(withZero.length).toBeGreaterThan(withUndefined.length)
    expect(withZero[2]).toBe('Found 0 matches')
  })
})

describe('buildLines — does not mutate the base array', () => {
  it('each call returns a fresh array', () => {
    const a = buildLines({ isImagePrompt: false, imageCount: 10 })
    const b = buildLines({ isImagePrompt: false, imageCount: 10, matchCount: 5 })
    // a should still have 2 items — not 3
    expect(a).toHaveLength(2)
    expect(b).toHaveLength(3)
  })
})
