import type { QueryFilter } from '@/lib/gemini/query'

export type FilterMod =
  | { type: 'remove'; index: number }
  | { type: 'add'; filter: QueryFilter }

/**
 * Parses a raw filter input string into a FilterMod.
 * Supported formats:
 *   field: value          → eq
 *   field < value         → lt
 *   field <= value        → lte
 *   field > value         → gt
 *   field >= value        → gte
 *   field != value        → neq
 *   bare word             → tags contains
 *
 * Returns null if the input is empty after trimming.
 */
export function parseFilterInput(raw: string): FilterMod | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const numericOp = trimmed.match(/^(.+?)\s*(<=|>=|<|>|!=)\s*(.+)$/)
  if (numericOp) {
    const [, field, rawOp, rawVal] = numericOp
    const opMap: Record<string, QueryFilter['operator']> = {
      '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte', '!=': 'neq',
    }
    const operator = opMap[rawOp]
    const numVal = parseFloat(rawVal)
    const value = isNaN(numVal) ? rawVal.trim() : numVal
    return { type: 'add', filter: { field: field.trim(), operator, value } }
  }

  const colonIdx = trimmed.indexOf(':')
  if (colonIdx !== -1) {
    const field = trimmed.slice(0, colonIdx).trim()
    const value = trimmed.slice(colonIdx + 1).trim()
    return { type: 'add', filter: { field, operator: 'eq', value } }
  }

  // Bare word → tags contains
  return { type: 'add', filter: { field: 'tags', operator: 'contains', value: trimmed } }
}

/**
 * Formats a QueryFilter into a human-readable chip label.
 * Uses short field names (last 2 segments) and operator symbols.
 */
export function formatChipLabel(filter: QueryFilter): string {
  const { field, operator, value } = filter
  const shortField = field.replace(/\[\]\./, '.').split('.').slice(-2).join('.')

  // Operators that use a word keyword need surrounding spaces;
  // symbolic operators attach directly to the field name.
  const opWord: Record<string, string> = { in: 'in' }
  const opSymbol: Record<string, string> = {
    eq: ':', neq: '≠', contains: ':', gte: '≥', lte: '≤', gt: '>', lt: '<',
  }

  const displayVal = Array.isArray(value)
    ? value.join(', ')
    : String(value)

  if (operator in opWord) {
    return `${shortField} ${opWord[operator]} ${displayVal}`
  }

  const sep = opSymbol[operator] ?? ':'
  return `${shortField}${sep} ${displayVal}`
}
