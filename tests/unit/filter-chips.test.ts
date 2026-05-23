import { describe, it, expect } from 'vitest'
import { formatChipLabel } from '@/components/chat/filter-chips.logic'

// ---------------------------------------------------------------------------
// formatChipLabel — human-readable output
// ---------------------------------------------------------------------------

describe('formatChipLabel — value-only fields (tags, object labels)', () => {
  it('returns just the value for tags contains', () => {
    expect(formatChipLabel({ field: 'tags', operator: 'contains', value: 'portrait' })).toBe('portrait')
  })

  it('returns just the value for objects[].label contains', () => {
    expect(formatChipLabel({ field: 'objects[].label', operator: 'contains', value: 'vase' })).toBe('vase')
  })

  it('prefixes "not" for neq on value-only fields', () => {
    expect(formatChipLabel({ field: 'tags', operator: 'neq', value: 'portrait' })).toBe('not portrait')
  })

  it('uses ≥ for gte on value-only fields', () => {
    expect(formatChipLabel({ field: 'tags', operator: 'gte', value: 5 })).toBe('≥ 5')
  })

  it('uses ≤ for lte on value-only fields', () => {
    expect(formatChipLabel({ field: 'tags', operator: 'lte', value: 3 })).toBe('≤ 3')
  })
})

describe('formatChipLabel — category-prefixed fields', () => {
  it('uses "color" prefix for dominant_color_name', () => {
    expect(formatChipLabel({ field: 'colors.dominant_color_name', operator: 'eq', value: 'turquoise' }))
      .toBe('color: turquoise')
  })

  it('uses "time" prefix for scene.time_of_day', () => {
    expect(formatChipLabel({ field: 'scene.time_of_day', operator: 'eq', value: 'golden hour' }))
      .toBe('time: golden hour')
  })

  it('uses "no people" for people.count eq 0', () => {
    expect(formatChipLabel({ field: 'people.count', operator: 'eq', value: 0 }))
      .toBe('no people')
  })

  it('uses "framing" prefix for composition.framing', () => {
    expect(formatChipLabel({ field: 'composition.framing', operator: 'eq', value: 'close-up' }))
      .toBe('framing: close-up')
  })

  it('uses "not" prefix for neq on category fields', () => {
    expect(formatChipLabel({ field: 'scene.setting', operator: 'neq', value: 'outdoor' }))
      .toBe('not setting: outdoor')
  })

  it('uses ≥ for gte on category fields', () => {
    expect(formatChipLabel({ field: 'quality_score', operator: 'gte', value: 0.8 }))
      .toBe('quality ≥ 0.8')
  })

  it('uses ≤ for lte on category fields', () => {
    expect(formatChipLabel({ field: 'quality_score', operator: 'lte', value: 0.5 }))
      .toBe('quality ≤ 0.5')
  })
})

describe('formatChipLabel — unknown fields fallback', () => {
  it('falls back to last path segment for unknown fields', () => {
    expect(formatChipLabel({ field: 'some.unknown.field', operator: 'eq', value: 'x' }))
      .toBe('field: x')
  })
})

describe('formatChipLabel — array values', () => {
  it('joins array values with comma-space', () => {
    expect(formatChipLabel({ field: 'tags', operator: 'in', value: ['a', 'b', 'c'] }))
      .toBe('a, b, c')
  })
})
