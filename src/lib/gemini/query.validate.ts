import { asRecord } from './parse-utils'

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gte'
  | 'lte'
  | 'gt'
  | 'lt'
  | 'in'

export type QueryFilter = {
  field: string
  operator: FilterOperator
  value: unknown
}

export type QuerySort = {
  field: string
  direction: 'asc' | 'desc'
}

export type QueryPlan = {
  filters: QueryFilter[]
  semantic_search: string | null
  sort: QuerySort | null
  limit: number
  clarification_note: string | null
  followups: string[]
}

export const VALID_OPERATORS: readonly FilterOperator[] = [
  'eq', 'neq', 'contains', 'gte', 'lte', 'gt', 'lt', 'in',
]

export const DEFAULT_PLAN: QueryPlan = {
  filters: [],
  semantic_search: null,
  sort: null,
  limit: 50,
  clarification_note: null,
  followups: [],
}

export function validateQueryPlan(raw: unknown): QueryPlan {
  const data = asRecord(raw)
  if (!data) return { ...DEFAULT_PLAN }

  const filters: QueryFilter[] = []
  if (Array.isArray(data.filters)) {
    for (const item of data.filters) {
      const f = asRecord(item)
      if (!f || typeof f.field !== 'string' || f.field.length === 0) continue
      if (!VALID_OPERATORS.includes(f.operator as FilterOperator)) continue
      if (!('value' in f)) continue
      filters.push({ field: f.field, operator: f.operator as FilterOperator, value: f.value })
    }
  }

  const semanticSearch = typeof data.semantic_search === 'string' && data.semantic_search.trim().length > 0
    ? data.semantic_search.trim()
    : null

  let sort: QuerySort | null = null
  const sortRaw = asRecord(data.sort)
  if (sortRaw && typeof sortRaw.field === 'string' && sortRaw.field.length > 0 && (sortRaw.direction === 'asc' || sortRaw.direction === 'desc')) {
    sort = { field: sortRaw.field, direction: sortRaw.direction }
  }

  const limit = typeof data.limit === 'number' && Number.isFinite(data.limit)
    ? Math.min(200, Math.max(1, Math.round(data.limit)))
    : 50

  const clarificationNote = typeof data.clarification_note === 'string' && data.clarification_note.trim().length > 0
    ? data.clarification_note.trim()
    : null

  const suggestedFollowups: string[] = []
  if (Array.isArray(data.followups)) {
    for (const item of data.followups) {
      if (typeof item === 'string' && item.trim().length > 0) {
        suggestedFollowups.push(item.trim())
      }
    }
  }

  return { filters, semantic_search: semanticSearch, sort, limit, clarification_note: clarificationNote, followups: suggestedFollowups }
}
