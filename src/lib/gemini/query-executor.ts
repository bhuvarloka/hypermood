import { createClient } from '@/lib/supabase/server'
import { embedText } from '@/lib/gemini/embedding'
import type { QueryPlan, QueryFilter } from '@/lib/gemini/query'
import type { Image } from '@/types/domain'

export type QueryResult = {
  images: Image[]
  total: number
}

// Columns that live on the images table (not in JSONB metadata).
// Used both to guard sort fields and to split filters between DB and client-side.
const IMAGES_TABLE_COLUMNS = new Set(['uploaded_at', 'captured_at', 'file_size_bytes'])

// Known safe metadata field paths. Any filter.field not in this set is rejected
// before being interpolated into SQL, preventing injection via crafted QueryPlans.
const ALLOWED_METADATA_FIELDS = new Set([
  'subject',
  'objects[].label',
  'objects[].prominence',
  'objects[].position',
  'objects[].attributes',
  'people.count',
  'people.descriptions[].position',
  'people.descriptions[].age_range',
  'people.descriptions[].gender_presentation',
  'people.descriptions[].clothing',
  'people.descriptions[].activity',
  'people.descriptions[].expression',
  'relationships',
  'colors.dominant',
  'colors.palette_mood',
  'colors.dominant_color_name',
  'scene.environment',
  'scene.setting',
  'scene.time_of_day',
  'scene.weather',
  'mood.emotional_tone',
  'mood.energy_level',
  'mood.aesthetic_style',
  'composition.framing',
  'composition.focal_point',
  'composition.symmetry',
  'composition.depth',
  'technical.blur_score',
  'technical.exposure',
  'technical.noise_level',
  'technical.is_screenshot',
  'technical.is_graphic',
  'technical.orientation',
  'quality_score',
  'texture_material',
  'text_content.has_text',
  'text_content.text_strings',
  'text_content.text_role',
  'description',
  'tags',
])

// Builds a chained JSONB path expression for containment queries (@>).
// All segments use -> (jsonb) so the result is comparable with another jsonb value.
// im. prefix matches the alias for image_metadata used in the RPC SQL.
function toJsonbContainmentPath(field: string): string {
  const parts = field.split('.')
  return `im.metadata${parts.map(p => `->'${p}'`).join('')}`
}

// Builds a scalar JSONB path expression for equality/comparison queries.
// Last segment uses ->> (text cast); intermediate segments use -> (jsonb).
// im. prefix matches the alias for image_metadata used in the RPC SQL.
function toJsonbScalarPath(field: string): string {
  const parts = field.split('.')
  if (parts.length === 1) return `im.metadata->>'${parts[0]}'`
  const chain = parts.slice(0, -1).map(p => `->'${p}'`).join('')
  return `im.metadata${chain}->>'${parts[parts.length - 1]}'`
}

// Builds a Postgres WHERE clause fragment for a single QueryFilter.
// Returns null for any filter that cannot be safely expressed (unknown field, bad operator).
function buildClause(filter: QueryFilter): string | null {
  const { field, operator, value } = filter

  if (!ALLOWED_METADATA_FIELDS.has(field)) return null

  // Array-element filters like "objects[].label" → JSONB @> containment
  if (field.includes('[]')) {
    if (operator !== 'contains') return null
    const arrayField = field.split('[]')[0]
    const leafField = field.split('[].')[1]
    if (!leafField) return null
    const jsonValue = JSON.stringify([{ [leafField]: value }])
    return `(im.metadata->'${arrayField}' @> '${jsonValue}'::jsonb)`
  }

  // Top-level or nested array fields (tags, texture_material, etc.) → @> containment
  if (operator === 'contains') {
    const arrayFields = new Set([
      'tags',
      'texture_material',
      'relationships',
      'colors.dominant',
      'text_content.text_strings',
    ])
    if (arrayFields.has(field)) {
      const jsonValue = JSON.stringify([value])
      return `(${toJsonbContainmentPath(field)} @> '${jsonValue}'::jsonb)`
    }
    // String substring match
    const escaped = String(value).replace(/'/g, "''")
    return `(${toJsonbScalarPath(field)} ilike '%${escaped}%')`
  }

  const scalarPath = toJsonbScalarPath(field)
  const escaped = String(value).replace(/'/g, "''")

  switch (operator) {
    case 'eq':
      return `(${scalarPath} = '${escaped}')`
    case 'neq':
      return `(${scalarPath} != '${escaped}')`
    case 'gte':
      return `((${scalarPath})::numeric >= ${Number(value)})`
    case 'lte':
      return `((${scalarPath})::numeric <= ${Number(value)})`
    case 'gt':
      return `((${scalarPath})::numeric > ${Number(value)})`
    case 'lt':
      return `((${scalarPath})::numeric < ${Number(value)})`
    case 'in': {
      if (!Array.isArray(value) || value.length === 0) return null
      const list = value.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ')
      return `(${scalarPath} IN (${list}))`
    }
    default:
      return null
  }
}

export async function executeQuery(plan: QueryPlan, rollId: string): Promise<QueryResult> {
  const supabase = await createClient()
  const { filters, semantic_search, sort, limit } = plan

  const clauses = filters.map(buildClause).filter((c): c is string => c !== null)

  if (semantic_search) {
    const queryVector = await embedText(semantic_search)
    const vectorLiteral = `[${queryVector.join(',')}]`

    // Over-fetch proportionally so post-hoc slicing still reaches `limit` results
    // after any rows excluded by metadata filters.
    const candidateLimit = Math.min(limit * 3, 300)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    let rpcResult
    if (clauses.length > 0) {
      rpcResult = await db.rpc('search_images_by_embedding_filtered', {
        p_roll_id: rollId,
        p_embedding: vectorLiteral,
        p_where_clause: clauses.join(' AND '),
        p_limit: candidateLimit,
      })
    } else {
      rpcResult = await db.rpc('search_images_by_embedding', {
        p_roll_id: rollId,
        p_embedding: vectorLiteral,
        p_limit: candidateLimit,
      })
    }

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

// Client-side filter evaluation against a deserialised JSONB metadata object.
function matchesFilter(meta: Record<string, unknown>, filter: QueryFilter): boolean {
  const { field, operator, value } = filter

  // Array-element filters (e.g. "objects[].label") — check if any element matches
  if (field.includes('[]')) {
    if (operator !== 'contains') return true
    const arrayField = field.split('[]')[0]
    const leafField = field.split('[].')[1]
    if (!leafField) return true
    const arr = getNestedValue(meta, arrayField)
    if (!Array.isArray(arr)) return false
    return arr.some(item =>
      typeof item === 'object' && item !== null &&
      (item as Record<string, unknown>)[leafField] === value
    )
  }

  const actual = getNestedValue(meta, field)

  switch (operator) {
    case 'eq':
      return actual == value
    case 'neq':
      return actual != value
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(value)
      if (typeof actual === 'string') return actual.toLowerCase().includes(String(value).toLowerCase())
      return false
    case 'gte':
      return Number(actual) >= Number(value)
    case 'lte':
      return Number(actual) <= Number(value)
    case 'gt':
      return Number(actual) > Number(value)
    case 'lt':
      return Number(actual) < Number(value)
    case 'in':
      return Array.isArray(value) && value.includes(actual)
    default:
      return true
  }
}

// Resolves a simple dot-notation path against a nested object. Does not handle [] notation —
// callers must check for [] before calling this.
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter(Boolean)
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}
