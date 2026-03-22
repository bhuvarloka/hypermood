import { createClient } from '@/lib/supabase/server'
import { embedText, EMBEDDING_MODEL_VERSION } from '@/lib/gemini/embedding'
import type { Image } from '@/types/domain'

// Blending weight: how much the centroid of reference images dominates over
// any supplemental text query. 0.7/0.3 preserves visual similarity intent
// while allowing text to steer results.
const CENTROID_WEIGHT = 0.7
const TEXT_WEIGHT = 0.3

// Default candidate pool to over-fetch before slicing to caller's limit.
const DEFAULT_LIMIT = 20
const CANDIDATE_MULTIPLIER = 3

export async function searchByImageReferences(
  imageIds: string[],
  rollId: string,
  textQuery?: string,
  limit = DEFAULT_LIMIT,
): Promise<Image[]> {
  if (imageIds.length === 0) return []

  const supabase = await createClient()

  type EmbeddingRow = { image_id: string; embedding: string; embedding_model_version: string }
  const { data: embeddingRows, error } = await supabase
    .from('image_embeddings')
    .select('image_id, embedding, embedding_model_version')
    .in('image_id', imageIds) as unknown as { data: EmbeddingRow[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  if (!embeddingRows || embeddingRows.length === 0) return []

  // Mixed-model vectors cannot be meaningfully averaged — their semantic spaces
  // are incompatible. Only use embeddings from the current model version.
  const compatibleRows = embeddingRows.filter(
    row => row.embedding_model_version === EMBEDDING_MODEL_VERSION,
  )
  if (compatibleRows.length === 0) return []

  // PostgREST returns pgvector columns as a JSON array string, not a parsed number[].
  const vectors: number[][] = compatibleRows.map(row =>
    JSON.parse(row.embedding as unknown as string),
  )

  // Guard against dimension mismatch (e.g. row written by a transitional model version
  // with a different output_dimensionality). A single bad vector corrupts the centroid.
  const expectedDim = vectors[0].length
  const uniformVectors = vectors.filter(v => v.length === expectedDim)
  if (uniformVectors.length === 0) return []

  const centroid = computeCentroid(uniformVectors)

  const blendedVector = textQuery
    ? await blendWithText(centroid, textQuery)
    : centroid

  const normalised = l2Normalise(blendedVector)
  const vectorLiteral = `[${normalised.join(',')}]`

  // Over-fetch enough that after excluding reference images we still reach `limit`.
  // Uncapped: if imageIds is large, the multiplier alone may not cover the exclusions.
  const candidateLimit = Math.min(limit * CANDIDATE_MULTIPLIER + imageIds.length, 500)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcRows, error: rpcError } = await (supabase as any).rpc(
    'search_images_by_embedding',
    {
      p_roll_id: rollId,
      p_embedding: vectorLiteral,
      p_limit: candidateLimit,
    },
  )

  if (rpcError) throw new Error(rpcError.message)

  const referenceSet = new Set(imageIds)
  const resultIds: string[] = ((rpcRows ?? []) as Array<{ image_id: string }>)
    .map(r => r.image_id)
    .filter(id => !referenceSet.has(id))
    .slice(0, limit)

  if (resultIds.length === 0) return []

  const { data: imageRows, error: imgError } = await supabase
    .from('images')
    .select('*')
    .in('id', resultIds)
    .eq('roll_id', rollId)

  if (imgError) throw new Error(imgError.message)

  // Re-rank by RPC similarity order. IDs missing from the images table (deleted
  // between the two queries) map to position Infinity so they sort to the end
  // rather than colliding at position 0 with the top result.
  const orderMap = new Map(resultIds.map((id, i) => [id, i]))
  return ((imageRows ?? []) as Image[]).sort(
    (a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity),
  )
}

// Element-wise mean of an array of equal-length vectors.
function computeCentroid(vectors: number[][]): number[] {
  const dim = vectors[0].length
  const sum = new Array<number>(dim).fill(0)
  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      sum[i] += vec[i]
    }
  }
  return sum.map(v => v / vectors.length)
}

// Weighted blend of image centroid and embedded text query.
async function blendWithText(centroid: number[], text: string): Promise<number[]> {
  const textVector = await embedText(text)
  return centroid.map((v, i) => CENTROID_WEIGHT * v + TEXT_WEIGHT * (textVector[i] ?? 0))
}

// Cosine distance (<=>) normalises by both magnitudes, so the absolute scale of
// the blended vector does not affect search results. We normalise anyway so the
// vector is consistent with what the model originally emitted — making the blend
// safe if the distance function is ever changed to L2 (<->).
function l2Normalise(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0))
  if (norm === 0) return vec
  return vec.map(v => v / norm)
}
