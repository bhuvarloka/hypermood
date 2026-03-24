// parse-utils.ts instantiates GoogleGenAI at module load — mock before any import.
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: vi.fn() }
  },
}))

import { describe, it, expect } from 'vitest'
import { tryParseJson, asRecord } from '@/lib/gemini/parse-utils'

describe('tryParseJson', () => {
  it('parses valid JSON directly', () => {
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses valid JSON array', () => {
    expect(tryParseJson('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('parses a primitive number', () => {
    expect(tryParseJson('42')).toBe(42)
  })

  it('strips ```json fence with language tag', () => {
    expect(tryParseJson('```json\n{"x":1}\n```')).toEqual({ x: 1 })
  })

  it('strips ```JSON fence with uppercase language tag', () => {
    expect(tryParseJson('```JSON\n{"x":1}\n```')).toEqual({ x: 1 })
  })

  it('strips fence with leading/trailing whitespace surrounding the block', () => {
    expect(tryParseJson('  ```json\n{"x":1}\n```  ')).toEqual({ x: 1 })
  })

  it('strips ``` fence without language tag', () => {
    expect(tryParseJson('```\n{"x":1}\n```')).toEqual({ x: 1 })
  })

  it('strips control chars (0x07) and still parses', () => {
    expect(tryParseJson('\x07{"a":1}\x07')).toEqual({ a: 1 })
  })

  it('preserves newline (0x0a) — not stripped by control-char regex', () => {
    // Newline is valid in JSON strings only when escaped; raw newline in value is invalid.
    // But a raw newline between tokens (whitespace) is fine — JSON.parse handles it.
    expect(tryParseJson('{\n"a":1\n}')).toEqual({ a: 1 })
  })

  it('preserves tab (0x09) — not stripped by control-char regex', () => {
    expect(tryParseJson('{\t"a":1}')).toEqual({ a: 1 })
  })

  it('returns null for completely unparseable string', () => {
    expect(tryParseJson('not json at all')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(tryParseJson('')).toBeNull()
  })

  it('returns null for markdown fence containing non-JSON', () => {
    expect(tryParseJson('```\nnot json\n```')).toBeNull()
  })

  it('carriage return (0x0d) is not stripped — raw CR inside a string value causes parse to fail', () => {
    // \r is not in the control-char regex range, so it is preserved.
    // A raw \r inside a JSON string literal is invalid and causes JSON.parse to throw.
    expect(tryParseJson('{"a":"b\rc"}')).toBeNull()
  })
})

describe('asRecord', () => {
  it('returns a plain object as-is', () => {
    const obj = { a: 1, b: 'x' }
    expect(asRecord(obj)).toBe(obj)
  })

  it('returns null for null', () => {
    expect(asRecord(null)).toBeNull()
  })

  it('returns null for a string', () => {
    expect(asRecord('hello')).toBeNull()
  })

  it('returns null for a number', () => {
    expect(asRecord(42)).toBeNull()
  })

  it('returns null for a boolean', () => {
    expect(asRecord(true)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(asRecord(undefined)).toBeNull()
  })

  it('returns null for an array', () => {
    expect(asRecord([1, 2, 3])).toBeNull()
  })
})
