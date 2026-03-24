import { describe, it, expect } from 'vitest'
import { buildClause, matchesFilter, getNestedValue } from '@/lib/gemini/query-executor.logic'
import type { QueryFilter } from '@/lib/gemini/query'

describe('buildClause — injection & allowlist', () => {
  it('returns null for a field not in the allowlist', () => {
    const f: QueryFilter = { field: 'user_id', operator: 'eq', value: 'x' }
    expect(buildClause(f)).toBeNull()
  })

  it('returns null for a SQL-injection-looking field name', () => {
    const f: QueryFilter = { field: 'injected; DROP TABLE--', operator: 'eq', value: 'x' }
    expect(buildClause(f)).toBeNull()
  })

  it('returns null for array-element field with non-contains operator', () => {
    const f: QueryFilter = { field: 'objects[].label', operator: 'eq', value: 'cat' }
    expect(buildClause(f)).toBeNull()
  })

  it('returns null for bare array field with no leaf (objects[])', () => {
    const f: QueryFilter = { field: 'objects[]', operator: 'contains', value: 'cat' }
    expect(buildClause(f)).toBeNull()
  })
})

describe('buildClause — array-element contains', () => {
  it('builds @> clause for objects[].label contains', () => {
    const f: QueryFilter = { field: 'objects[].label', operator: 'contains', value: 'cat' }
    const clause = buildClause(f)
    expect(clause).toContain('@>')
    expect(clause).toContain('"label":"cat"')
    expect(clause).toContain("'objects'")
  })

  it('builds @> clause for people.descriptions[].clothing contains', () => {
    const f: QueryFilter = { field: 'people.descriptions[].clothing', operator: 'contains', value: 'blue jacket' }
    const clause = buildClause(f)
    expect(clause).toContain('@>')
    expect(clause).toContain('"clothing":"blue jacket"')
  })
})

describe('buildClause — scalar contains', () => {
  it('builds ilike clause for description contains', () => {
    const f: QueryFilter = { field: 'description', operator: 'contains', value: 'beach' }
    const clause = buildClause(f)
    expect(clause).toContain('ilike')
    expect(clause).toContain('%beach%')
  })

  it('escapes single quotes in ilike value (SQL injection guard)', () => {
    const f: QueryFilter = { field: 'description', operator: 'contains', value: "it's a test" }
    const clause = buildClause(f)
    expect(clause).toContain("it''s a test")
    expect(clause).not.toMatch(/'[^']it's/)
  })

  it('builds @> clause for tags contains', () => {
    const f: QueryFilter = { field: 'tags', operator: 'contains', value: 'sunset' }
    const clause = buildClause(f)
    expect(clause).toContain('@>')
    expect(clause).toContain('"sunset"')
  })
})

describe('buildClause — equality operators', () => {
  it('builds = clause for scene.setting eq indoor', () => {
    const f: QueryFilter = { field: 'scene.setting', operator: 'eq', value: 'indoor' }
    const clause = buildClause(f)
    expect(clause).toContain("= 'indoor'")
    expect(clause).toContain("metadata->'scene'->>'setting'")
  })

  it('escapes single quotes in eq value', () => {
    const f: QueryFilter = { field: 'scene.setting', operator: 'eq', value: "'; DROP TABLE images;--" }
    const clause = buildClause(f)
    expect(clause).toContain("''")
    expect(clause).not.toMatch(/'[^']'/)
  })

  it('builds != clause for neq operator', () => {
    const f: QueryFilter = { field: 'scene.setting', operator: 'neq', value: 'indoor' }
    expect(buildClause(f)).toContain('!=')
  })

  it('builds = clause for single-segment field quality_score', () => {
    const f: QueryFilter = { field: 'quality_score', operator: 'eq', value: '0.9' }
    const clause = buildClause(f)
    expect(clause).toContain("metadata->>'quality_score'")
  })
})

describe('buildClause — numeric operators', () => {
  it('builds ::numeric >= clause for gte', () => {
    const f: QueryFilter = { field: 'technical.blur_score', operator: 'gte', value: 0.5 }
    const clause = buildClause(f)
    expect(clause).toContain('::numeric >=')
    expect(clause).toContain('0.5')
  })

  it('builds ::numeric <= clause for lte', () => {
    const f: QueryFilter = { field: 'mood.energy_level', operator: 'lte', value: 0.3 }
    expect(buildClause(f)).toContain('::numeric <=')
  })

  it('builds ::numeric > clause for gt', () => {
    const f: QueryFilter = { field: 'quality_score', operator: 'gt', value: 0.8 }
    expect(buildClause(f)).toContain('::numeric >')
  })

  it('builds ::numeric < clause for lt', () => {
    const f: QueryFilter = { field: 'people.count', operator: 'lt', value: 3 }
    expect(buildClause(f)).toContain('::numeric <')
  })

  it('returns null for gte with non-numeric string value', () => {
    const f: QueryFilter = { field: 'quality_score', operator: 'gte', value: 'high' }
    expect(buildClause(f)).toBeNull()
  })
})

describe('buildClause — in operator', () => {
  it('builds IN clause for array of values', () => {
    const f: QueryFilter = { field: 'scene.setting', operator: 'in', value: ['indoor', 'outdoor'] }
    const clause = buildClause(f)
    expect(clause).toContain('IN')
    expect(clause).toContain("'indoor'")
    expect(clause).toContain("'outdoor'")
  })

  it('returns null for empty in array', () => {
    const f: QueryFilter = { field: 'scene.setting', operator: 'in', value: [] }
    expect(buildClause(f)).toBeNull()
  })

  it('returns null for non-array in value', () => {
    const f: QueryFilter = { field: 'scene.setting', operator: 'in', value: 'indoor' }
    expect(buildClause(f)).toBeNull()
  })

  it('escapes single quotes in in values', () => {
    const f: QueryFilter = { field: 'scene.setting', operator: 'in', value: ["it's", 'outdoor'] }
    const clause = buildClause(f)
    expect(clause).toContain("it''s")
  })
})

describe('buildClause — unknown operator', () => {
  it('returns null for unknown operator', () => {
    const f = { field: 'scene.setting', operator: 'like' as 'eq', value: 'beach' }
    expect(buildClause(f)).toBeNull()
  })
})

describe('matchesFilter — eq', () => {
  it('matches string equality', () => {
    const f: QueryFilter = { field: 'scene.setting', operator: 'eq', value: 'indoor' }
    expect(matchesFilter({ scene: { setting: 'indoor' } }, f)).toBe(true)
  })

  it('does not match different string', () => {
    const f: QueryFilter = { field: 'scene.setting', operator: 'eq', value: 'indoor' }
    expect(matchesFilter({ scene: { setting: 'outdoor' } }, f)).toBe(false)
  })

  // eq uses == (loose equality) — 0 == '0' is true in JS
  it('loose equality: number 0 eq string "0" is true', () => {
    const f: QueryFilter = { field: 'people.count', operator: 'eq', value: '0' }
    expect(matchesFilter({ people: { count: 0 } }, f)).toBe(true)
  })
})

describe('matchesFilter — contains on string', () => {
  it('matches case-insensitive substring', () => {
    const f: QueryFilter = { field: 'description', operator: 'contains', value: 'beach' }
    expect(matchesFilter({ description: 'A day at the Beach' }, f)).toBe(true)
  })

  it('returns false when substring not present', () => {
    const f: QueryFilter = { field: 'description', operator: 'contains', value: 'mountain' }
    expect(matchesFilter({ description: 'A day at the beach' }, f)).toBe(false)
  })
})

describe('matchesFilter — contains on array', () => {
  it('matches when value is in array (case-sensitive)', () => {
    const f: QueryFilter = { field: 'tags', operator: 'contains', value: 'sunset' }
    expect(matchesFilter({ tags: ['beach', 'sunset', 'travel'] }, f)).toBe(true)
  })

  it('array contains is case-insensitive — "Sunset" matches filter "sunset"', () => {
    const f: QueryFilter = { field: 'tags', operator: 'contains', value: 'sunset' }
    expect(matchesFilter({ tags: ['Beach', 'Sunset'] }, f)).toBe(true)
  })

  it('returns false when value absent from array', () => {
    const f: QueryFilter = { field: 'tags', operator: 'contains', value: 'mountain' }
    expect(matchesFilter({ tags: ['beach', 'sunset'] }, f)).toBe(false)
  })

  it('returns false for contains on a number field', () => {
    const f: QueryFilter = { field: 'quality_score', operator: 'contains', value: '0.9' }
    expect(matchesFilter({ quality_score: 0.9 }, f)).toBe(false)
  })
})

describe('matchesFilter — numeric operators boundary', () => {
  it('gte: equal value is true', () => {
    const f: QueryFilter = { field: 'quality_score', operator: 'gte', value: 0.5 }
    expect(matchesFilter({ quality_score: 0.5 }, f)).toBe(true)
  })

  it('gt: equal value is false', () => {
    const f: QueryFilter = { field: 'quality_score', operator: 'gt', value: 0.5 }
    expect(matchesFilter({ quality_score: 0.5 }, f)).toBe(false)
  })

  it('lte: equal value is true', () => {
    const f: QueryFilter = { field: 'mood.energy_level', operator: 'lte', value: 0.3 }
    expect(matchesFilter({ mood: { energy_level: 0.3 } }, f)).toBe(true)
  })

  it('lt: equal value is false', () => {
    const f: QueryFilter = { field: 'mood.energy_level', operator: 'lt', value: 0.3 }
    expect(matchesFilter({ mood: { energy_level: 0.3 } }, f)).toBe(false)
  })
})

describe('matchesFilter — in operator', () => {
  it('matches when actual value is in the list', () => {
    const f: QueryFilter = { field: 'scene.setting', operator: 'in', value: ['indoor', 'outdoor'] }
    expect(matchesFilter({ scene: { setting: 'indoor' } }, f)).toBe(true)
  })

  it('returns false when actual value is not in the list', () => {
    const f: QueryFilter = { field: 'scene.setting', operator: 'in', value: ['indoor', 'outdoor'] }
    expect(matchesFilter({ scene: { setting: 'mixed' } }, f)).toBe(false)
  })
})

describe('matchesFilter — array-element filter', () => {
  it('returns true when an object in the array matches the leaf field', () => {
    const f: QueryFilter = { field: 'objects[].label', operator: 'contains', value: 'cat' }
    const meta = { objects: [{ label: 'dog' }, { label: 'cat' }] }
    expect(matchesFilter(meta, f)).toBe(true)
  })

  it('returns false when no element matches', () => {
    const f: QueryFilter = { field: 'objects[].label', operator: 'contains', value: 'bird' }
    const meta = { objects: [{ label: 'dog' }, { label: 'cat' }] }
    expect(matchesFilter(meta, f)).toBe(false)
  })

  it('returns false when the array field is not an array', () => {
    const f: QueryFilter = { field: 'objects[].label', operator: 'contains', value: 'cat' }
    expect(matchesFilter({ objects: 'not an array' }, f)).toBe(false)
  })

  it('pass-through true for non-contains operator on array-element field', () => {
    const f: QueryFilter = { field: 'objects[].label', operator: 'eq', value: 'cat' }
    expect(matchesFilter({ objects: [{ label: 'dog' }] }, f)).toBe(true)
  })
})

describe('matchesFilter — unknown operator', () => {
  it('returns true (pass-through) for unknown operator', () => {
    const f = { field: 'scene.setting', operator: 'like' as 'eq', value: 'x' }
    expect(matchesFilter({ scene: { setting: 'indoor' } }, f)).toBe(true)
  })
})

describe('getNestedValue', () => {
  it('resolves single key', () => {
    expect(getNestedValue({ a: 1 }, 'a')).toBe(1)
  })

  it('resolves nested dot-path', () => {
    expect(getNestedValue({ scene: { setting: 'indoor' } }, 'scene.setting')).toBe('indoor')
  })

  it('returns undefined for missing key', () => {
    expect(getNestedValue({ a: 1 }, 'b')).toBeUndefined()
  })

  it('returns undefined when intermediate node is null', () => {
    expect(getNestedValue({ scene: null } as Record<string, unknown>, 'scene.setting')).toBeUndefined()
  })

  it('returns undefined when intermediate node is not an object', () => {
    expect(getNestedValue({ scene: 'string' }, 'scene.setting')).toBeUndefined()
  })

  it('empty string path returns undefined', () => {
    const meta = { scene: { setting: 'indoor' } }
    expect(getNestedValue(meta, '')).toBeUndefined()
  })

  it('trailing dot behaves same as without trailing dot', () => {
    const meta = { scene: { setting: 'indoor' } }
    expect(getNestedValue(meta, 'scene.')).toEqual({ setting: 'indoor' })
  })
})
