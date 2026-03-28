import { describe, it, expect } from 'vitest'
import { formatCapturedDate } from '@/components/roll/darkroom.logic'

describe('formatCapturedDate', () => {
  it('formats a valid ISO timestamp', () => {
    const result = formatCapturedDate('2024-06-15T10:30:00Z')
    expect(result).not.toBeNull()
    // Must contain the year and short month
    expect(result).toContain('2024')
    expect(result).toContain('Jun')
    expect(result).toContain('15')
  })

  it('returns null for null input', () => {
    expect(formatCapturedDate(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(formatCapturedDate(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(formatCapturedDate('')).toBeNull()
  })

  it('returns null for a malformed date string', () => {
    expect(formatCapturedDate('not-a-date')).toBeNull()
  })

  it('returns null for a partial date string that produces NaN', () => {
    expect(formatCapturedDate('2024-99-99')).toBeNull()
  })

  it('formats a date-only string (no time component)', () => {
    const result = formatCapturedDate('2023-01-01')
    expect(result).not.toBeNull()
    expect(result).toContain('2023')
    expect(result).toContain('Jan')
  })

  it('formats December correctly', () => {
    const result = formatCapturedDate('2022-12-25T00:00:00Z')
    expect(result).toContain('Dec')
    expect(result).toContain('25')
    expect(result).toContain('2022')
  })

  it('handles a Unix epoch timestamp string', () => {
    // new Date('0') is valid in JS — ensures no silent crash
    const result = formatCapturedDate('1970-01-01T00:00:00Z')
    expect(result).not.toBeNull()
    expect(result).toContain('1970')
  })

  it('does not throw for any input — always returns string or null', () => {
    const inputs = [null, undefined, '', 'garbage', '2024-01-01', '2024-01-01T00:00:00Z']
    for (const input of inputs) {
      expect(() => formatCapturedDate(input)).not.toThrow()
      const result = formatCapturedDate(input)
      expect(result === null || typeof result === 'string').toBe(true)
    }
  })
})
