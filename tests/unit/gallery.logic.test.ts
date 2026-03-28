import { describe, it, expect } from 'vitest'
import { toSlug, staggerDelay, pluralImages } from '@/actions/gallery.logic'

// ---------------------------------------------------------------------------
// toSlug
// ---------------------------------------------------------------------------

describe('toSlug — basic transformations', () => {
  it('lowercases the name', () => {
    expect(toSlug('Summer Trip')).toBe('summer-trip')
  })

  it('trims leading/trailing whitespace', () => {
    expect(toSlug('  Paris  ')).toBe('paris')
  })

  it('collapses multiple spaces into a single hyphen', () => {
    expect(toSlug('A   B')).toBe('a-b')
  })

  it('collapses multiple consecutive hyphens', () => {
    expect(toSlug('hello--world')).toBe('hello-world')
  })

  it('strips special characters that are not alphanumeric, spaces, or hyphens', () => {
    expect(toSlug('Hello, World!')).toBe('hello-world')
  })

  it('strips accented/unicode characters', () => {
    // ñ is not in [a-z0-9], must be stripped
    expect(toSlug('España')).toBe('espaa')
  })

  it('strips apostrophes', () => {
    expect(toSlug("mom's birthday")).toBe('moms-birthday')
  })

  it('handles all-special-char input by producing empty string', () => {
    expect(toSlug('!!!')).toBe('')
  })

  it('handles a name that is already a valid slug', () => {
    expect(toSlug('my-gallery')).toBe('my-gallery')
  })

  it('does not produce a trailing hyphen from a trailing space', () => {
    expect(toSlug('paris ')).toBe('paris')
  })

  it('does not produce a leading hyphen from a leading space', () => {
    expect(toSlug(' paris')).toBe('paris')
  })

  it('preserves numbers', () => {
    expect(toSlug('roll 42')).toBe('roll-42')
  })

  it('handles mixed alphanumeric and special chars', () => {
    expect(toSlug('Best of 2024!')).toBe('best-of-2024')
  })
})

// ---------------------------------------------------------------------------
// staggerDelay
// ---------------------------------------------------------------------------

describe('staggerDelay', () => {
  it('returns 0 for index 0', () => {
    expect(staggerDelay(0)).toBe(0)
  })

  it('returns 30ms per step for early indices', () => {
    expect(staggerDelay(1)).toBe(30)
    expect(staggerDelay(5)).toBe(150)
  })

  it('caps at 600ms', () => {
    expect(staggerDelay(20)).toBe(600)
    expect(staggerDelay(100)).toBe(600)
  })

  it('caps exactly at index 20 (20 * 30 = 600)', () => {
    expect(staggerDelay(20)).toBe(600)
  })

  it('index 19 is below cap (19 * 30 = 570)', () => {
    expect(staggerDelay(19)).toBe(570)
  })

  it('never returns a negative value', () => {
    // Should not happen in practice but guard against it
    expect(staggerDelay(0)).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// pluralImages
// ---------------------------------------------------------------------------

describe('pluralImages', () => {
  it('uses singular for count 1', () => {
    expect(pluralImages(1)).toBe('1 image')
  })

  it('uses plural for count 0', () => {
    expect(pluralImages(0)).toBe('0 images')
  })

  it('uses plural for count 2', () => {
    expect(pluralImages(2)).toBe('2 images')
  })

  it('uses plural for large counts', () => {
    expect(pluralImages(100)).toBe('100 images')
  })
})
