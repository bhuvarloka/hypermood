import { describe, it, expect } from 'vitest'
import { getInitial, buildPreviewSlots } from '@/components/roll/rail.logic'

// ---------------------------------------------------------------------------
// getInitial
// ---------------------------------------------------------------------------

describe('getInitial', () => {
  it('returns uppercased first character of email', () => {
    expect(getInitial('alice@example.com')).toBe('A')
  })

  it('uppercases lowercase first char', () => {
    expect(getInitial('bob@example.com')).toBe('B')
  })

  it('returns ? for an empty string', () => {
    expect(getInitial('')).toBe('?')
  })

  it('handles a single character string', () => {
    expect(getInitial('x')).toBe('X')
  })

  it('handles email starting with a number', () => {
    expect(getInitial('1user@example.com')).toBe('1')
  })

  it('handles email starting with an uppercase letter (no double-upper)', () => {
    expect(getInitial('Alice@example.com')).toBe('A')
  })
})

// ---------------------------------------------------------------------------
// buildPreviewSlots
// ---------------------------------------------------------------------------

describe('buildPreviewSlots', () => {
  it('returns 4 slots by default', () => {
    expect(buildPreviewSlots([])).toHaveLength(4)
  })

  it('fills available keys and null-pads the rest', () => {
    expect(buildPreviewSlots(['img1', 'img2'])).toEqual(['img1', 'img2', null, null])
  })

  it('returns all nulls when no keys are provided', () => {
    expect(buildPreviewSlots([])).toEqual([null, null, null, null])
  })

  it('fills all 4 when exactly 4 keys provided', () => {
    expect(buildPreviewSlots(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('truncates to 4 even when more keys are provided', () => {
    const result = buildPreviewSlots(['a', 'b', 'c', 'd', 'e'])
    expect(result).toHaveLength(4)
    expect(result).not.toContain('e')
  })

  it('respects a custom count', () => {
    expect(buildPreviewSlots(['a', 'b', 'c'], 2)).toEqual(['a', 'b'])
  })
})
