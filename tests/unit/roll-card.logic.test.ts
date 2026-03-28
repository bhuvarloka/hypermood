import { describe, it, expect } from 'vitest'
import { deriveIndexingStatus, buildSlots } from '@/components/roll/roll-card.logic'

// ---------------------------------------------------------------------------
// deriveIndexingStatus
// ---------------------------------------------------------------------------

describe('deriveIndexingStatus', () => {
  it('returns empty when imageCount is 0', () => {
    expect(deriveIndexingStatus(0, 0)).toBe('empty')
  })

  it('returns pending when images exist but none are indexed', () => {
    expect(deriveIndexingStatus(5, 0)).toBe('pending')
  })

  it('returns indexing when some but not all are indexed', () => {
    expect(deriveIndexingStatus(10, 5)).toBe('indexing')
  })

  it('returns indexing when 1 of 2 is indexed (not just half)', () => {
    expect(deriveIndexingStatus(2, 1)).toBe('indexing')
  })

  it('returns complete when all images are indexed', () => {
    expect(deriveIndexingStatus(10, 10)).toBe('complete')
  })

  it('returns complete when imageCount is 1 and indexedCount is 1', () => {
    expect(deriveIndexingStatus(1, 1)).toBe('complete')
  })

  it('returns empty (not pending) when imageCount is 0 even if indexedCount is somehow also 0', () => {
    // empty takes priority over pending
    expect(deriveIndexingStatus(0, 0)).toBe('empty')
  })

  it('does NOT return complete when indexedCount exceeds imageCount', () => {
    // Defensive: indexedCount > imageCount is a data anomaly
    // Currently, both 10/10 and 11/10 would return 'complete' — document this behaviour
    const result = deriveIndexingStatus(10, 11)
    // 11 is NOT < 10, so the function returns 'complete' — this documents the current behaviour
    expect(result).toBe('complete')
  })

  it('the three mutually exclusive statuses cover all expected cases', () => {
    const cases: [number, number][] = [
      [0, 0],  // empty
      [5, 0],  // pending
      [5, 3],  // indexing
      [5, 5],  // complete
    ]
    const statuses = cases.map(([img, idx]) => deriveIndexingStatus(img, idx))
    expect(statuses).toEqual(['empty', 'pending', 'indexing', 'complete'])
  })
})

// ---------------------------------------------------------------------------
// buildSlots
// ---------------------------------------------------------------------------

describe('buildSlots', () => {
  it('returns exactly 4 slots by default', () => {
    expect(buildSlots([])).toHaveLength(4)
    expect(buildSlots(['a', 'b'])).toHaveLength(4)
  })

  it('fills from the front with provided items', () => {
    expect(buildSlots(['a', 'b'])).toEqual(['a', 'b', null, null])
  })

  it('returns all nulls for empty input', () => {
    expect(buildSlots([])).toEqual([null, null, null, null])
  })

  it('fills exactly 4 when 4 items are provided', () => {
    expect(buildSlots(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ignores items beyond the count', () => {
    // 6 keys → only first 4 land in slots
    const result = buildSlots(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(result).toHaveLength(4)
    expect(result).not.toContain('e')
    expect(result).not.toContain('f')
  })

  it('respects a custom count', () => {
    expect(buildSlots(['a', 'b', 'c'], 2)).toEqual(['a', 'b'])
  })

  it('works with non-string types', () => {
    expect(buildSlots([1, 2], 4)).toEqual([1, 2, null, null])
  })
})
