import { z } from 'zod'

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

const filterSchema = z
  .object({
    field: z.string().min(1),
    operator: z.enum(['eq', 'neq', 'contains', 'gte', 'lte', 'gt', 'lt', 'in']),
    value: z.unknown(),
  })
  .refine(f => 'value' in f, { message: 'value key is required' })

const nonEmptyString = z.string().trim().min(1)

const queryPlanSchema = z.object({
  filters: z
    .array(filterSchema.catch(() => null as unknown as QueryFilter))
    .catch([])
    .transform(items => items.filter((f): f is QueryFilter => f !== null)),
  semantic_search: nonEmptyString.nullable().catch(null),
  sort: z
    .object({
      field: z.string().min(1),
      direction: z.enum(['asc', 'desc']),
    })
    .nullable()
    .catch(null),
  limit: z
    .number()
    .refine(n => Number.isFinite(n), { message: 'must be finite' })
    .transform(n => Math.min(200, Math.max(1, Math.round(n))))
    .catch(50),
  clarification_note: nonEmptyString.nullable().catch(null),
  followups: z
    .array(nonEmptyString.catch(null as unknown as string))
    .catch([])
    .transform(items => items.filter((s): s is string => s !== null)),
})

export function validateQueryPlan(raw: unknown): QueryPlan {
  const result = queryPlanSchema.safeParse(raw)
  if (!result.success) {
    // LLM returned a shape the schema doesn't recognise — log for diagnosis and use defaults.
    console.error('[query.validate] unexpected QueryPlan shape:', result.error.message, '\nraw:', JSON.stringify(raw))
    return { ...DEFAULT_PLAN }
  }
  return result.data
}
