import { describe, it, expect } from 'vitest'
import { reorderItems } from '@/components/gallery/gallery-drawer.logic'

describe('reorderItems', () => {
  it('moves item from start to end', () => {
    expect(reorderItems(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('moves item from end to start', () => {
    expect(reorderItems(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('moves item forward by one', () => {
    expect(reorderItems(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })

  it('moves item backward by one', () => {
    expect(reorderItems(['a', 'b', 'c'], 1, 0)).toEqual(['b', 'a', 'c'])
  })

  it('returns same reference when dragIndex === dropIndex', () => {
    const arr = ['a', 'b', 'c']
    expect(reorderItems(arr, 1, 1)).toBe(arr)
  })

  it('does not mutate the original array', () => {
    const original = ['a', 'b', 'c']
    const copy = [...original]
    reorderItems(original, 0, 2)
    expect(original).toEqual(copy)
  })

  it('handles a two-element array swap', () => {
    expect(reorderItems(['a', 'b'], 0, 1)).toEqual(['b', 'a'])
    expect(reorderItems(['a', 'b'], 1, 0)).toEqual(['b', 'a'])
  })

  it('handles a single-element array (no-op)', () => {
    const arr = ['only']
    expect(reorderItems(arr, 0, 0)).toBe(arr)
  })

  it('handles object arrays (works by reference)', () => {
    const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' }
    const result = reorderItems([a, b, c], 0, 2)
    expect(result[0]).toBe(b)
    expect(result[1]).toBe(c)
    expect(result[2]).toBe(a)
  })

  it('splicing from middle to middle is correct', () => {
    // [a,b,c,d,e]: move index 1 (b) to index 3
    // Expected: [a, c, d, b, e]
    expect(reorderItems(['a', 'b', 'c', 'd', 'e'], 1, 3)).toEqual(['a', 'c', 'd', 'b', 'e'])
  })

  it('does not drop any items during reorder', () => {
    const items = ['a', 'b', 'c', 'd']
    const result = reorderItems(items, 0, 3)
    expect(result).toHaveLength(items.length)
    expect(new Set(result)).toEqual(new Set(items))
  })
})
