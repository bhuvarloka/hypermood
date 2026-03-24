import { describe, it, expect } from 'vitest'
import {
  computeCentroid,
  l2Normalise,
  blendVectors,
  CENTROID_WEIGHT,
  TEXT_WEIGHT,
} from '@/lib/gemini/image-search.math'

describe('computeCentroid', () => {
  it('single vector returns that vector unchanged', () => {
    expect(computeCentroid([[1, 2, 3]])).toEqual([1, 2, 3])
  })

  it('two identical vectors return the same vector', () => {
    expect(computeCentroid([[2, 4], [2, 4]])).toEqual([2, 4])
  })

  it('averages two orthogonal vectors', () => {
    expect(computeCentroid([[0, 2], [2, 0]])).toEqual([1, 1])
  })

  it('averages three unit-axis vectors', () => {
    expect(computeCentroid([[3, 0, 0], [0, 3, 0], [0, 0, 3]])).toEqual([1, 1, 1])
  })

  it('produces float average, not truncated', () => {
    expect(computeCentroid([[1], [2]])).toEqual([1.5])
  })

  it('handles negative values', () => {
    expect(computeCentroid([[-1, -1], [1, 1]])).toEqual([0, 0])
  })

  it('all-zero vectors produce zero centroid', () => {
    expect(computeCentroid([[0, 0, 0], [0, 0, 0]])).toEqual([0, 0, 0])
  })

  it('empty input array throws TypeError', () => {
    // vectors[0].length throws when vectors is []; callers must guard against empty input
    expect(() => computeCentroid([])).toThrow(TypeError)
  })

  it('mismatched vector dimensions throw TypeError', () => {
    expect(() => computeCentroid([[1, 2, 3], [1, 2]])).toThrow(TypeError)
  })
})

describe('l2Normalise', () => {
  it('already-unit vector [1,0,0] stays [1,0,0]', () => {
    expect(l2Normalise([1, 0, 0])).toEqual([1, 0, 0])
  })

  it('zero vector returns zero vector without NaN', () => {
    const result = l2Normalise([0, 0, 0])
    expect(result).toEqual([0, 0, 0])
    expect(result.some(Number.isNaN)).toBe(false)
  })

  it('[3,4] normalises to [0.6, 0.8]', () => {
    const result = l2Normalise([3, 4])
    expect(result[0]).toBeCloseTo(0.6, 10)
    expect(result[1]).toBeCloseTo(0.8, 10)
  })

  it('normalises negative values correctly', () => {
    const result = l2Normalise([-3, 4])
    expect(result[0]).toBeCloseTo(-0.6, 10)
    expect(result[1]).toBeCloseTo(0.8, 10)
  })

  it('single-element [5] normalises to [1]', () => {
    expect(l2Normalise([5])).toEqual([1])
  })

  it('result has unit norm for any non-zero input', () => {
    const result = l2Normalise([1, 2, 3, 4])
    const norm = Math.sqrt(result.reduce((acc, v) => acc + v * v, 0))
    expect(norm).toBeCloseTo(1.0, 10)
  })

  it('very small values produce a finite result, not NaN', () => {
    const result = l2Normalise([1e-300, 1e-300])
    expect(result.every(Number.isFinite)).toBe(true)
  })

  it('empty vector returns empty vector without crashing', () => {
    expect(l2Normalise([])).toEqual([])
  })
})

describe('blendVectors', () => {
  it('weights constants sum to 1', () => {
    expect(CENTROID_WEIGHT + TEXT_WEIGHT).toBeCloseTo(1.0)
  })

  it('blends centroid [0,1] with text [1,0] using 0.7/0.3 weights', () => {
    const result = blendVectors([0, 1], [1, 0])
    expect(result[0]).toBeCloseTo(0.3)
    expect(result[1]).toBeCloseTo(0.7)
  })

  it('text vector shorter than centroid — missing dims filled with 0', () => {
    const result = blendVectors([1, 1, 1], [0])
    expect(result[0]).toBeCloseTo(CENTROID_WEIGHT * 1 + TEXT_WEIGHT * 0)
    expect(result[1]).toBeCloseTo(CENTROID_WEIGHT * 1 + TEXT_WEIGHT * 0)
    expect(result[2]).toBeCloseTo(CENTROID_WEIGHT * 1 + TEXT_WEIGHT * 0)
  })

  it('identical vectors blend to the same vector (scale only changes)', () => {
    const result = blendVectors([2, 4], [2, 4])
    expect(result[0]).toBeCloseTo(2)
    expect(result[1]).toBeCloseTo(4)
  })

  it('centroid shorter than textVec — extra text dimensions are silently dropped', () => {
    // centroid has 1 dim, textVec has 3; map iterates centroid length so dims 1,2 are ignored
    const result = blendVectors([1], [1, 1, 1])
    expect(result).toHaveLength(1)
    expect(result[0]).toBeCloseTo(CENTROID_WEIGHT * 1 + TEXT_WEIGHT * 1)
  })
})
