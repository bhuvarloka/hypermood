import { describe, it, expect } from 'vitest'
import { validateQueryPlan, DEFAULT_PLAN } from '@/lib/gemini/query.validate'

describe('validateQueryPlan', () => {
  it('returns DEFAULT_PLAN for null input', () => {
    expect(validateQueryPlan(null)).toEqual(DEFAULT_PLAN)
  })

  it('returns DEFAULT_PLAN for non-object input', () => {
    expect(validateQueryPlan('string')).toEqual(DEFAULT_PLAN)
    expect(validateQueryPlan(42)).toEqual(DEFAULT_PLAN)
    expect(validateQueryPlan(true)).toEqual(DEFAULT_PLAN)
  })

  it('returns DEFAULT_PLAN for empty object', () => {
    const result = validateQueryPlan({})
    expect(result.filters).toEqual([])
    expect(result.semantic_search).toBeNull()
    expect(result.sort).toBeNull()
    expect(result.limit).toBe(50)
    expect(result.clarification_note).toBeNull()
  })

  describe('filters', () => {
    it('drops filter with invalid operator', () => {
      const result = validateQueryPlan({ filters: [{ field: 'tags', operator: 'like', value: 'x' }] })
      expect(result.filters).toHaveLength(0)
    })

    it('drops filter with empty field', () => {
      const result = validateQueryPlan({ filters: [{ field: '', operator: 'eq', value: 'x' }] })
      expect(result.filters).toHaveLength(0)
    })

    it('drops non-object filter items', () => {
      const result = validateQueryPlan({ filters: ['not an object', 42, null] })
      expect(result.filters).toHaveLength(0)
    })

    it('passes through a valid filter unchanged', () => {
      const filter = { field: 'tags', operator: 'contains', value: 'sunset' }
      const result = validateQueryPlan({ filters: [filter] })
      expect(result.filters).toHaveLength(1)
      expect(result.filters[0]).toEqual(filter)
    })

    it('passes through multiple valid filters', () => {
      const filters = [
        { field: 'tags', operator: 'contains', value: 'beach' },
        { field: 'scene.setting', operator: 'eq', value: 'outdoor' },
      ]
      const result = validateQueryPlan({ filters })
      expect(result.filters).toHaveLength(2)
    })
  })

  describe('semantic_search', () => {
    it('returns null for empty string', () => {
      expect(validateQueryPlan({ semantic_search: '' }).semantic_search).toBeNull()
    })

    it('trims whitespace-only string to null', () => {
      expect(validateQueryPlan({ semantic_search: '   ' }).semantic_search).toBeNull()
    })

    it('trims and returns non-empty string', () => {
      expect(validateQueryPlan({ semantic_search: '  beach  ' }).semantic_search).toBe('beach')
    })

    it('returns null for non-string', () => {
      expect(validateQueryPlan({ semantic_search: 42 }).semantic_search).toBeNull()
    })
  })

  describe('limit', () => {
    it('clamps limit above 200 to 200', () => {
      expect(validateQueryPlan({ limit: 500 }).limit).toBe(200)
    })

    it('clamps limit below 1 to 1', () => {
      expect(validateQueryPlan({ limit: 0 }).limit).toBe(1)
    })

    it('rounds fractional limit', () => {
      expect(validateQueryPlan({ limit: 25.7 }).limit).toBe(26)
    })

    it('falls back to 50 for Infinity', () => {
      expect(validateQueryPlan({ limit: Infinity }).limit).toBe(50)
    })

    it('falls back to 50 for NaN', () => {
      expect(validateQueryPlan({ limit: NaN }).limit).toBe(50)
    })

    it('falls back to 50 for string limit', () => {
      expect(validateQueryPlan({ limit: '100' }).limit).toBe(50)
    })
  })

  describe('sort', () => {
    it('returns null for sort with invalid direction', () => {
      const result = validateQueryPlan({ sort: { field: 'uploaded_at', direction: 'ascending' } })
      expect(result.sort).toBeNull()
    })

    it('passes through valid sort', () => {
      const result = validateQueryPlan({ sort: { field: 'uploaded_at', direction: 'desc' } })
      expect(result.sort).toEqual({ field: 'uploaded_at', direction: 'desc' })
    })

    it('returns null for null sort', () => {
      expect(validateQueryPlan({ sort: null }).sort).toBeNull()
    })

    it('returns null for non-object sort', () => {
      expect(validateQueryPlan({ sort: 'uploaded_at' }).sort).toBeNull()
    })
  })

  describe('clarification_note', () => {
    it('returns null for empty string', () => {
      expect(validateQueryPlan({ clarification_note: '' }).clarification_note).toBeNull()
    })

    it('returns null for whitespace-only string', () => {
      expect(validateQueryPlan({ clarification_note: '   ' }).clarification_note).toBeNull()
    })

    it('trims and returns non-empty note', () => {
      expect(validateQueryPlan({ clarification_note: '  Ambiguous.  ' }).clarification_note).toBe('Ambiguous.')
    })

    it('returns null for non-string', () => {
      expect(validateQueryPlan({ clarification_note: true }).clarification_note).toBeNull()
    })
  })
})
