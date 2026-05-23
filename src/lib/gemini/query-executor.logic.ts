import type { QueryFilter } from '@/lib/gemini/query'

// Columns that live on the images table (not in JSONB metadata).
export const IMAGES_TABLE_COLUMNS = new Set(['uploaded_at', 'captured_at', 'file_size_bytes'])

// Known safe metadata field paths. Any filter.field not in this set is rejected
// before being interpolated into SQL, preventing injection via crafted QueryPlans.
export const ALLOWED_METADATA_FIELDS = new Set([
  'subject',
  'objects[].label',
  'objects[].prominence',
  'people.count',
  'colors.dominant',
  'colors.palette_mood',
  'colors.dominant_color_name',
  'scene.setting',
  'scene.time_of_day',
  'composition.framing',
  'technical.is_screenshot',
  'technical.is_graphic',
  'technical.orientation',
  'quality_score',
  'text_content.has_text',
  'text_content.text_strings',
  'text_content.text_role',
  'description',
  'tags',
])

export function toJsonbContainmentPath(field: string): string {
  const parts = field.split('.')
  return `im.metadata${parts.map(p => `->'${p}'`).join('')}`
}

export function toJsonbScalarPath(field: string): string {
  const parts = field.split('.')
  if (parts.length === 1) return `im.metadata->>'${parts[0]}'`
  const chain = parts.slice(0, -1).map(p => `->'${p}'`).join('')
  return `im.metadata${chain}->>'${parts[parts.length - 1]}'`
}

// Returns null (not throws) so callers can skip individual bad filters without aborting the whole query.
export function buildClause(filter: QueryFilter): string | null {
  const { field, operator, value } = filter

  if (!ALLOWED_METADATA_FIELDS.has(field)) return null

  if (field.includes('[]')) {
    if (operator !== 'contains') return null
    const arrayField = field.split('[]')[0]
    const leafField = field.split('[].')[1]
    if (!leafField) return null
    const escaped = String(value).replace(/'/g, "''")
    // Use EXISTS + jsonb_array_elements for substring matching on string leaf fields
    // (e.g. label "porcelain vase" must match a search for "vase").
    // @> containment requires exact equality and would miss partial labels.
    return `(EXISTS (SELECT 1 FROM jsonb_array_elements(im.metadata->'${arrayField}') AS elem WHERE (elem->>'${leafField}') ilike '%${escaped}%'))`
  }

  if (operator === 'contains') {
    const arrayFields = new Set([
      'tags',
      'colors.dominant',
      'text_content.text_strings',
    ])
    if (arrayFields.has(field)) {
      const jsonValue = JSON.stringify([value])
      return `(${toJsonbContainmentPath(field)} @> '${jsonValue}'::jsonb)`
    }
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
    case 'lte':
    case 'gt':
    case 'lt': {
      const n = Number(value)
      if (!Number.isFinite(n)) return null
      const op = operator === 'gte' ? '>=' : operator === 'lte' ? '<=' : operator === 'gt' ? '>' : '<'
      return `((${scalarPath})::numeric ${op} ${n})`
    }
    case 'in': {
      if (!Array.isArray(value) || value.length === 0) return null
      const list = value.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ')
      return `(${scalarPath} IN (${list}))`
    }
    default:
      return null
  }
}

export function matchesFilter(meta: Record<string, unknown>, filter: QueryFilter): boolean {
  const { field, operator, value } = filter

  if (field.includes('[]')) {
    if (operator !== 'contains') return true
    const arrayField = field.split('[]')[0]
    const leafField = field.split('[].')[1]
    if (!leafField) return true
    const arr = getNestedValue(meta, arrayField)
    if (!Array.isArray(arr)) return false
    return arr.some(item => {
      if (typeof item !== 'object' || item === null) return false
      const itemValue = (item as Record<string, unknown>)[leafField]
      // Use substring match for string fields (e.g. label "porcelain vase" should match "vase")
      if (typeof itemValue === 'string') {
        return itemValue.toLowerCase().includes(String(value).toLowerCase())
      }
      return itemValue === value
    })
  }

  const actual = getNestedValue(meta, field)

  switch (operator) {
    case 'eq':
      return actual == value
    case 'neq':
      return actual != value
    case 'contains':
      if (Array.isArray(actual)) return actual.some(v => String(v).toLowerCase() === String(value).toLowerCase())
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

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter(Boolean)
  if (parts.length === 0) return undefined
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}
