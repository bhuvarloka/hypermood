import { createClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/gemini/embedding'
import type { QueryPlan } from '@/lib/gemini/query'
import { IMAGES_TABLE_COLUMNS, buildClause, matchesFilter } from './query-executor.logic'
import type { Image } from '@/types/domain'

// Server-process cache: same semantic_search string always produces the same vector,
// so we avoid re-calling the embedding API when the user removes/adds filter chips.
const embeddingCache = new Map<string, number[]>()

export type QueryResult = {
  images: Image[]
  total: number
}

export async function executeQuery(plan: QueryPlan, rollId: string): Promise<QueryResult> {
  const supabase = await createClient()
  const { filters, semantic_search, sort, limit } = plan

  const clauses = filters.map(buildClause).filter((c): c is string => c !== null)

  if (semantic_search) {
    const cached = embeddingCache.get(semantic_search)
    const queryVector = cached ?? await embedText(semantic_search)
    if (!cached) embeddingCache.set(semantic_search, queryVector)
    const vectorLiteral = `[${queryVector.join(',')}]`

    // Over-fetch proportionally so post-hoc slicing still reaches `limit` results
    // after any rows excluded by metadata filters.
    const candidateLimit = Math.min(limit * 3, 300)

    const rpcResult = clauses.length > 0
      ? await supabase.rpc('search_images_by_embedding_filtered', {
          p_roll_id: rollId,
          p_embedding: vectorLiteral,
          p_where_clause: clauses.join(' AND '),
          p_limit: candidateLimit,
        })
      : await supabase.rpc('search_images_by_embedding', {
          p_roll_id: rollId,
          p_embedding: vectorLiteral,
          p_limit: candidateLimit,
        })

    if (rpcResult.error) throw new Error(rpcResult.error.message)

    const rows = (rpcResult.data ?? []) as Array<{ image_id: string; similarity: number }>
    const imageIds = rows.slice(0, limit).map(r => r.image_id)

    if (imageIds.length === 0) return { images: [], total: 0 }

    const { data: imageRows, error } = await supabase
      .from('images')
      .select('*')
      .in('id', imageIds)
      .eq('roll_id', rollId)

    if (error) throw new Error(error.message)

    const images = (imageRows ?? []) as Image[]
    // Preserve similarity ordering from the vector search
    const orderMap = new Map(imageIds.map((id, i) => [id, i]))
    const sorted = images.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))

    return { images: sorted, total: sorted.length }
  }

  // Metadata-only path: fetch indexed images with their metadata, then filter client-side.
  // PostgREST cannot apply raw JSONB WHERE clauses via the JS client, so we over-fetch
  // and filter in JS. Acceptable at ADR-004 scale ceiling (~1000 images/roll).
  let query = supabase
    .from('images')
    .select('*, image_metadata!inner(metadata)')
    .eq('roll_id', rollId)
    .eq('status', 'indexed')

  if (sort && IMAGES_TABLE_COLUMNS.has(sort.field)) {
    query = query.order(sort.field, { ascending: sort.direction === 'asc' })
  } else {
    query = query.order('uploaded_at', { ascending: false })
  }

  query = query.limit(Math.min(limit * 3, 500))

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const metadataFilters = filters.filter(f => !IMAGES_TABLE_COLUMNS.has(f.field))

  const filtered = (data ?? []).filter(row => {
    const meta = (row as Record<string, unknown> & { image_metadata?: { metadata: unknown } }).image_metadata?.metadata
    if (!meta || typeof meta !== 'object') return metadataFilters.length === 0
    for (const filter of metadataFilters) {
      if (!matchesFilter(meta as Record<string, unknown>, filter)) return false
    }
    return true
  })

  const images = filtered.slice(0, limit).map(row => {
    const { image_metadata: _omit, ...image } = row as Record<string, unknown> & { image_metadata?: unknown }
    return image as Image
  })

  return { images, total: images.length }
}

