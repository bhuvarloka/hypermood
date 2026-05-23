import { describe, it, expect } from 'vitest'
import {
  detectMimeType,
  validateMetadata,
  DEFAULTS,
} from '@/lib/gemini/vision.validate'

describe('detectMimeType', () => {
  it('identifies PNG by magic bytes', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
    expect(detectMimeType(buf)).toBe('image/png')
  })

  it('identifies JPEG by magic bytes', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(detectMimeType(buf)).toBe('image/jpeg')
  })

  it('identifies WebP by RIFF/WEBP header', () => {
    const buf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // file size (irrelevant)
      0x57, 0x45, 0x42, 0x50, // WEBP
    ])
    expect(detectMimeType(buf)).toBe('image/webp')
  })

  it('identifies GIF by magic bytes', () => {
    const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0])
    expect(detectMimeType(buf)).toBe('image/gif')
  })

  it('falls back to image/jpeg for unknown bytes', () => {
    const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(detectMimeType(buf)).toBe('image/jpeg')
  })

  it('correctly identifies PNG from a 4-byte buffer (magic bytes need only 2 bytes)', () => {
    const shortPng = Buffer.from([0x89, 0x50, 0x4e, 0x47]) // 4 bytes — PNG magic
    expect(detectMimeType(shortPng)).toBe('image/png')
  })

  it('empty buffer returns image/jpeg without crashing', () => {
    expect(detectMimeType(Buffer.alloc(0))).toBe('image/jpeg')
  })

  it('1-byte buffer returns image/jpeg without crashing (boundary of < 2 guard)', () => {
    expect(detectMimeType(Buffer.from([0x89]))).toBe('image/jpeg')
  })

  it('2-byte PNG magic returns image/png (minimum valid header)', () => {
    expect(detectMimeType(Buffer.from([0x89, 0x50]))).toBe('image/png')
  })

  it('RIFF header without WEBP marker falls back to image/jpeg', () => {
    const buf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // file size
      0x00, 0x00, 0x00, 0x00, // NOT WEBP
    ])
    expect(detectMimeType(buf)).toBe('image/jpeg')
  })
})

describe('validateMetadata', () => {
  it('returns DEFAULTS for null input', () => {
    const result = validateMetadata(null)
    expect(result.subject).toBe(DEFAULTS.subject)
    expect(result.objects).toEqual([])
    expect(result.people.count).toBe(0)
    expect(result.quality_score).toBe(DEFAULTS.quality_score)
  })

  it('returns DEFAULTS for undefined input', () => {
    const result = validateMetadata(undefined)
    expect(result.subject).toBe(DEFAULTS.subject)
  })

  it('returns DEFAULTS for empty object', () => {
    const result = validateMetadata({})
    expect(result.subject).toBe(DEFAULTS.subject)
    expect(result.tags).toEqual([])
  })

  it('filters out objects with empty label', () => {
    const result = validateMetadata({
      objects: [{ label: '', prominence: 'primary' }],
    })
    expect(result.objects).toHaveLength(0)
  })

  it('filters out objects with null label', () => {
    const result = validateMetadata({
      objects: [{ label: null, prominence: 'primary' }],
    })
    expect(result.objects).toHaveLength(0)
  })

  it('falls back prominence to "secondary" for invalid value', () => {
    const result = validateMetadata({
      objects: [{ label: 'cat', prominence: 'dominant' }],
    })
    expect(result.objects[0].prominence).toBe('secondary')
  })

  it('lowercases tags', () => {
    const result = validateMetadata({ tags: ['Beach', 'SUNSET', 'Travel'] })
    expect(result.tags).toEqual(['beach', 'sunset', 'travel'])
  })

  it('filters non-string elements from tags array', () => {
    const result = validateMetadata({ tags: ['beach', 42, null, 'sunset'] })
    expect(result.tags).toEqual(['beach', 'sunset'])
  })

  it('clamps quality_score above 1 to 1', () => {
    const result = validateMetadata({ quality_score: 2.0 })
    expect(result.quality_score).toBe(1.0)
  })

  it('clamps quality_score below 0 to 0', () => {
    const result = validateMetadata({ quality_score: -1.0 })
    expect(result.quality_score).toBe(0.0)
  })

  it('preserves people.count when it is a number', () => {
    const result = validateMetadata({ people: { count: 5 } })
    expect(result.people.count).toBe(5)
  })

  it('preserves people.count: 0 (zero is a valid number)', () => {
    const result = validateMetadata({ people: { count: 0 } })
    expect(result.people.count).toBe(0)
  })

  it('falls back people.count to 0 when count is not a number', () => {
    const result = validateMetadata({ people: { count: 'two' } })
    expect(result.people.count).toBe(0)
  })

  it('falls back is_screenshot to false for string "true"', () => {
    const result = validateMetadata({ technical: { is_screenshot: 'true' } })
    expect(result.technical.is_screenshot).toBe(false)
  })

  it('falls back subject to default for empty string', () => {
    const result = validateMetadata({ subject: '' })
    expect(result.subject).toBe(DEFAULTS.subject)
  })

  it('text_content: has_text string "yes" falls back to false', () => {
    const result = validateMetadata({ text_content: { has_text: 'yes', text_strings: [], text_role: 'none' } })
    expect(result.text_content.has_text).toBe(false)
  })

  it('text_content: text_strings with non-string elements are filtered', () => {
    const result = validateMetadata({ text_content: { has_text: true, text_strings: ['hello', 42, null], text_role: 'signage' } })
    expect(result.text_content.text_strings).toEqual(['hello'])
  })

  it('text_content: null text_role falls back to default', () => {
    const result = validateMetadata({ text_content: { has_text: false, text_strings: [], text_role: null } })
    expect(result.text_content.text_role).toBe(DEFAULTS.text_content.text_role)
  })

  it('text_content: missing text_content uses DEFAULTS', () => {
    const result = validateMetadata({})
    expect(result.text_content.has_text).toBe(DEFAULTS.text_content.has_text)
    expect(result.text_content.text_strings).toEqual(DEFAULTS.text_content.text_strings)
    expect(result.text_content.text_role).toBe(DEFAULTS.text_content.text_role)
  })

  it('colors: null colors uses DEFAULTS for all color fields', () => {
    const result = validateMetadata({ colors: null })
    expect(result.colors.dominant).toEqual(DEFAULTS.colors.dominant)
    expect(result.colors.palette_mood).toBe(DEFAULTS.colors.palette_mood)
    expect(result.colors.dominant_color_name).toBe(DEFAULTS.colors.dominant_color_name)
  })

  it('colors: dominant with non-string elements are filtered', () => {
    const result = validateMetadata({ colors: { dominant: ['#fff', 42, null], palette_mood: 'warm', dominant_color_name: 'white' } })
    expect(result.colors.dominant).toEqual(['#fff'])
  })

  it('scene: null scene uses DEFAULTS for all scene fields', () => {
    const result = validateMetadata({ scene: null })
    expect(result.scene.setting).toBe(DEFAULTS.scene.setting)
    expect(result.scene.time_of_day).toBe(DEFAULTS.scene.time_of_day)
  })

  it('composition: null composition uses DEFAULTS for framing', () => {
    const result = validateMetadata({ composition: null })
    expect(result.composition.framing).toBe(DEFAULTS.composition.framing)
  })

  it('passes a full valid payload through correctly', () => {
    const payload = {
      subject: 'dog on a beach',
      objects: [{ label: 'dog', prominence: 'primary' }],
      people: { count: 0 },
      colors: { dominant: ['#f5c842'], palette_mood: 'warm', dominant_color_name: 'yellow' },
      scene: { setting: 'outdoor', time_of_day: 'golden hour' },
      composition: { framing: 'wide shot' },
      technical: { is_screenshot: false, is_graphic: false, orientation: 'landscape' },
      quality_score: 0.85,
      text_content: { has_text: false, text_strings: [], text_role: 'none' },
      description: 'A golden retriever runs along a sandy beach at golden hour.',
      tags: ['dog', 'beach', 'golden hour', 'outdoor'],
    }
    const result = validateMetadata(payload)
    expect(result.subject).toBe('dog on a beach')
    expect(result.objects[0].label).toBe('dog')
    expect(result.quality_score).toBe(0.85)
    expect(result.tags).toEqual(['dog', 'beach', 'golden hour', 'outdoor'])
    expect(result.scene.setting).toBe('outdoor')
  })
})
