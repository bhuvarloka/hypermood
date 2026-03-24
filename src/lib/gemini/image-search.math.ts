// Blending weight: how much the centroid of reference images dominates over
// any supplemental text query. 0.7/0.3 preserves visual similarity intent
// while allowing text to steer results.
export const CENTROID_WEIGHT = 0.7
export const TEXT_WEIGHT = 0.3

export function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) throw new TypeError('computeCentroid requires at least one vector')
  const dim = vectors[0].length
  const sum = new Array<number>(dim).fill(0)
  for (const vec of vectors) {
    if (vec.length !== dim) throw new TypeError(`computeCentroid requires all vectors to have the same dimension (expected ${dim}, got ${vec.length})`)
    for (let i = 0; i < dim; i++) {
      sum[i] += vec[i]
    }
  }
  return sum.map(v => v / vectors.length)
}

export function blendVectors(centroid: number[], textVec: number[]): number[] {
  return centroid.map((v, i) => CENTROID_WEIGHT * v + TEXT_WEIGHT * (textVec[i] ?? 0))
}

// Cosine distance normalises by both magnitudes, so the absolute scale of
// the blended vector does not affect search results. We normalise anyway so the
// vector is consistent with what the model originally emitted.
export function l2Normalise(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0))
  if (norm === 0) return vec
  return vec.map(v => v / norm)
}
