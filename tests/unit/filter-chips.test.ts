import { describe, it, expect } from 'vitest'
import { parseFilterInput, formatChipLabel } from '@/components/chat/filter-chips.logic'

// ---------------------------------------------------------------------------
// parseFilterInput
// ---------------------------------------------------------------------------

describe('parseFilterInput — numeric operator parsing', () => {
  it('parses < as lt with numeric value', () => {
    const result = parseFilterInput('width < 1000')
    expect(result).toEqual({ type: 'add', filter: { field: 'width', operator: 'lt', value: 1000 } })
  })

  it('parses <= as lte', () => {
    const result = parseFilterInput('quality <= 5')
    expect(result).toEqual({ type: 'add', filter: { field: 'quality', operator: 'lte', value: 5 } })
  })

  it('parses > as gt', () => {
    const result = parseFilterInput('score > 8')
    expect(result).toEqual({ type: 'add', filter: { field: 'score', operator: 'gt', value: 8 } })
  })

  it('parses >= as gte', () => {
    const result = parseFilterInput('file_size >= 200')
    expect(result).toEqual({ type: 'add', filter: { field: 'file_size', operator: 'gte', value: 200 } })
  })

  it('parses != as neq', () => {
    const result = parseFilterInput('status != failed')
    expect(result).toEqual({ type: 'add', filter: { field: 'status', operator: 'neq', value: 'failed' } })
  })

  it('treats non-numeric right-hand side as string (not NaN)', () => {
    const result = parseFilterInput('scene != outdoor')
    expect(result).toEqual({ type: 'add', filter: { field: 'scene', operator: 'neq', value: 'outdoor' } })
  })

  it('correctly parses <= before < (longer match wins)', () => {
    // If < were matched before <=, "width <= 100" would produce wrong op
    const result = parseFilterInput('width <= 100')
    expect(result?.type === 'add' && result.filter.operator).toBe('lte')
    expect(result?.type === 'add' && result.filter.value).toBe(100)
  })

  it('correctly parses >= before > (longer match wins)', () => {
    const result = parseFilterInput('width >= 100')
    expect(result?.type === 'add' && result.filter.operator).toBe('gte')
  })

  it('trims whitespace around field name', () => {
    const result = parseFilterInput('  width  < 500')
    expect(result?.type === 'add' && result.filter.field).toBe('width')
  })

  it('trims whitespace around value', () => {
    const result = parseFilterInput('scene !=  outdoor ')
    expect(result?.type === 'add' && result.filter.value).toBe('outdoor')
  })

  it('parses float values', () => {
    const result = parseFilterInput('quality > 7.5')
    expect(result?.type === 'add' && result.filter.value).toBe(7.5)
  })
})

describe('parseFilterInput — colon (eq) parsing', () => {
  it('parses field: value as eq', () => {
    const result = parseFilterInput('scene: portrait')
    expect(result).toEqual({ type: 'add', filter: { field: 'scene', operator: 'eq', value: 'portrait' } })
  })

  it('trims both sides of the colon', () => {
    const result = parseFilterInput('  scene :  portrait  ')
    expect(result?.type === 'add' && result.filter.field).toBe('scene')
    expect(result?.type === 'add' && result.filter.value).toBe('portrait')
  })

  it('uses first colon as delimiter when value also contains a colon', () => {
    // e.g. "label: foo: bar" → field="label", value="foo: bar"
    const result = parseFilterInput('label: foo: bar')
    expect(result?.type === 'add' && result.filter.field).toBe('label')
    expect(result?.type === 'add' && result.filter.value).toBe('foo: bar')
  })

  it('preserves empty value string when nothing after colon', () => {
    const result = parseFilterInput('scene:')
    expect(result?.type === 'add' && result.filter.value).toBe('')
  })
})

describe('parseFilterInput — bare word (tags contains) fallback', () => {
  it('returns tags contains for a single word', () => {
    const result = parseFilterInput('portrait')
    expect(result).toEqual({ type: 'add', filter: { field: 'tags', operator: 'contains', value: 'portrait' } })
  })

  it('returns tags contains for a multi-word phrase with no operator', () => {
    const result = parseFilterInput('golden hour')
    expect(result).toEqual({ type: 'add', filter: { field: 'tags', operator: 'contains', value: 'golden hour' } })
  })
})

describe('parseFilterInput — empty / whitespace', () => {
  it('returns null for empty string', () => {
    expect(parseFilterInput('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(parseFilterInput('   ')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// formatChipLabel
// ---------------------------------------------------------------------------

describe('formatChipLabel — operator symbols', () => {
  it('uses : for eq', () => {
    expect(formatChipLabel({ field: 'scene', operator: 'eq', value: 'portrait' })).toBe('scene: portrait')
  })

  it('uses ≠ for neq', () => {
    expect(formatChipLabel({ field: 'scene', operator: 'neq', value: 'outdoor' })).toBe('scene≠ outdoor')
  })

  it('uses ≥ for gte', () => {
    expect(formatChipLabel({ field: 'quality', operator: 'gte', value: 8 })).toBe('quality≥ 8')
  })

  it('uses ≤ for lte', () => {
    expect(formatChipLabel({ field: 'quality', operator: 'lte', value: 5 })).toBe('quality≤ 5')
  })

  it('uses > for gt', () => {
    expect(formatChipLabel({ field: 'score', operator: 'gt', value: 7 })).toBe('score> 7')
  })

  it('uses < for lt', () => {
    expect(formatChipLabel({ field: 'score', operator: 'lt', value: 3 })).toBe('score< 3')
  })

  it('uses in for in operator', () => {
    expect(formatChipLabel({ field: 'scene', operator: 'in', value: ['a', 'b'] })).toBe('scene in a, b')
  })

  it('falls back to : for unknown operators', () => {
    // Ensures new operators added to the DB do not crash the UI
    // @ts-expect-error — intentionally testing an unknown operator
    expect(formatChipLabel({ field: 'x', operator: 'unknown_op', value: 'y' })).toBe('x: y')
  })
})

describe('formatChipLabel — field shortening', () => {
  it('shortens deeply nested fields to last 2 segments', () => {
    // metadata.subject.face → subject.face
    expect(formatChipLabel({ field: 'metadata.subject.face', operator: 'eq', value: 'true' }))
      .toBe('subject.face: true')
  })

  it('handles array notation in field path', () => {
    // metadata.tags[].value → tags.value
    expect(formatChipLabel({ field: 'metadata.tags[].value', operator: 'contains', value: 'sky' }))
      .toBe('tags.value: sky')
  })

  it('keeps short single-segment fields intact', () => {
    expect(formatChipLabel({ field: 'scene', operator: 'eq', value: 'x' })).toMatch(/^scene/)
  })
})

describe('formatChipLabel — array values', () => {
  it('joins array values with comma-space', () => {
    expect(formatChipLabel({ field: 'tags', operator: 'in', value: ['a', 'b', 'c'] }))
      .toBe('tags in a, b, c')
  })

  it('handles single-element array', () => {
    expect(formatChipLabel({ field: 'tags', operator: 'in', value: ['portrait'] }))
      .toBe('tags in portrait')
  })

  it('handles empty array', () => {
    expect(formatChipLabel({ field: 'tags', operator: 'in', value: [] }))
      .toBe('tags in ')
  })
})

describe('formatChipLabel — numeric values', () => {
  it('renders numbers as strings', () => {
    expect(formatChipLabel({ field: 'quality', operator: 'gte', value: 8 }))
      .toContain('8')
  })
})
