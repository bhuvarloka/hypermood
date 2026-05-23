import { createClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/gemini/embedding'
import type { QueryPlan } from '@/lib/gemini/query'
import { IMAGES_TABLE_COLUMNS, buildClause } from './query-executor.logic'
import type { Image } from '@/types/domain'

// Server-process cache: same semantic_search string always produces the same vector,
// so we avoid re-calling the embedding API when the user removes/adds filter chips.
const embeddingCache = new Map<string, number[]>()

export type QueryResult = {
  images: Image[]
  total: number
}

export async function executeQuery(plan: QueryPlan, rollId: string, precomputedEmbedding?: Promise<number[]> | null): Promise<QueryResult> {
  const supabase = await createClient()
  const { filters, semantic_search, sort, limit } = plan

  const clauses = filters.map(buildClause).filter((c): c is string => c !== null)

  if (semantic_search) {
    const cached = embeddingCache.get(semantic_search)
    // Use the pre-computed embedding promise if available (started in parallel during LLM stream).
    const queryVector = cached ?? await (precomputedEmbedding ?? embedText(semantic_search))
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

  // Metadata-only path: delegate filtering to the filter_images_by_metadata RPC so
  // the WHERE clause runs server-side instead of over-fetching and filtering in JS.
  const metadataClauses = filters.map(buildClause).filter((c): c is string => c !== null)

  if (metadataClauses.length > 0) {
    const sortField = sort && IMAGES_TABLE_COLUMNS.has(sort.field) ? sort.field : 'uploaded_at'
    const sortAsc = sort ? sort.direction === 'asc' : false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcResult = await (supabase as any).rpc('filter_images_by_metadata', {
      p_roll_id: rollId,
      p_where_clause: metadataClauses.join(' AND '),
      p_sort_field: sortField,
      p_sort_asc: sortAsc,
      p_limit: limit,
    })

    if (rpcResult.error) throw new Error(rpcResult.error.message)
    const images = (rpcResult.data ?? []) as Image[]
    return { images, total: images.length }
  }

  // No filters at all — plain fetch of all indexed images in this roll.
  let query = supabase
    .from('images')
    .select('*')
    .eq('roll_id', rollId)
    .eq('status', 'indexed')

  if (sort && IMAGES_TABLE_COLUMNS.has(sort.field)) {
    query = query.order(sort.field, { ascending: sort.direction === 'asc' })
  } else {
    query = query.order('uploaded_at', { ascending: false })
  }

  query = query.limit(limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const images = (data ?? []) as Image[]
  return { images, total: images.length }
}

