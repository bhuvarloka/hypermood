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
      objects: [{ label: '', prominence: 'primary', position: 'center', attributes: [] }],
    })
    expect(result.objects).toHaveLength(0)
  })

  it('filters out objects with null label', () => {
    const result = validateMetadata({
      objects: [{ label: null, prominence: 'primary', position: 'center', attributes: [] }],
    })
    expect(result.objects).toHaveLength(0)
  })

  it('falls back prominence to "secondary" for invalid value', () => {
    const result = validateMetadata({
      objects: [{ label: 'cat', prominence: 'dominant', position: 'center', attributes: [] }],
    })
    expect(result.objects[0].prominence).toBe('secondary')
  })

  it('falls back position to "center" for invalid value', () => {
    const result = validateMetadata({
      objects: [{ label: 'cat', prominence: 'primary', position: 'floating', attributes: [] }],
    })
    expect(result.objects[0].position).toBe('center')
  })

  it('lowercases tags', () => {
    const result = validateMetadata({ tags: ['Beach', 'SUNSET', 'Travel'] })
    expect(result.tags).toEqual(['beach', 'sunset', 'travel'])
  })

  it('filters non-string elements from tags array', () => {
    const result = validateMetadata({ tags: ['beach', 42, null, 'sunset'] })
    expect(result.tags).toEqual(['beach', 'sunset'])
  })

  it('clamps energy_level below 0 to 0', () => {
    const result = validateMetadata({ mood: { energy_level: -0.5, emotional_tone: 'calm', aesthetic_style: 'minimal' } })
    expect(result.mood.energy_level).toBe(0)
  })

  it('clamps energy_level above 1 to 1', () => {
    const result = validateMetadata({ mood: { energy_level: 1.5, emotional_tone: 'energetic', aesthetic_style: 'editorial' } })
    expect(result.mood.energy_level).toBe(1)
  })

  it('falls back energy_level for NaN', () => {
    const result = validateMetadata({ mood: { energy_level: NaN } })
    expect(result.mood.energy_level).toBe(DEFAULTS.mood.energy_level)
  })

  it('falls back energy_level for Infinity', () => {
    const result = validateMetadata({ mood: { energy_level: Infinity } })
    expect(result.mood.energy_level).toBe(DEFAULTS.mood.energy_level)
  })

  it('clamps quality_score above 1 to 1', () => {
    const result = validateMetadata({ quality_score: 2.0 })
    expect(result.quality_score).toBe(1.0)
  })

  it('clamps quality_score below 0 to 0', () => {
    const result = validateMetadata({ quality_score: -1.0 })
    expect(result.quality_score).toBe(0.0)
  })

  it('clamps blur_score to 0–1 range', () => {
    expect(validateMetadata({ technical: { blur_score: 5.0 } }).technical.blur_score).toBe(1.0)
    expect(validateMetadata({ technical: { blur_score: -1.0 } }).technical.blur_score).toBe(0.0)
  })

  it('falls back people.count to descriptions.length when count is not a number', () => {
    const result = validateMetadata({
      people: {
        count: 'two',
        descriptions: [
          { position: 'center', age_range: 'adult', gender_presentation: 'ambiguous', clothing: [], activity: 'walking', expression: 'neutral' },
        ],
      },
    })
    expect(result.people.count).toBe(1)
  })

  it('preserves people.count when it is a number, regardless of descriptions length', () => {
    const result = validateMetadata({
      people: {
        count: 5,
        descriptions: [
          { position: 'left', age_range: 'young adult', gender_presentation: 'feminine', clothing: [], activity: 'sitting', expression: 'smiling' },
        ],
      },
    })
    expect(result.people.count).toBe(5)
  })

  it('preserves people.count: 0 (zero is a valid number)', () => {
    const result = validateMetadata({ people: { count: 0, descriptions: [] } })
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

  it('passes a full valid payload through correctly', () => {
    const payload = {
      subject: 'dog on a beach',
      objects: [{ label: 'dog', prominence: 'primary', position: 'center', attributes: ['golden', 'fluffy'] }],
      people: { count: 0, descriptions: [] },
      relationships: ['dog running along shoreline'],
      colors: { dominant: ['#f5c842'], palette_mood: 'warm', dominant_color_name: 'yellow' },
      scene: { environment: 'beach', setting: 'outdoor', time_of_day: 'golden hour', weather: 'clear' },
      mood: { emotional_tone: 'joyful', energy_level: 0.8, aesthetic_style: 'documentary' },
      composition: { framing: 'wide shot', focal_point: 'dog', symmetry: 'asymmetric', depth: 'deep (all in focus)' },
      technical: { blur_score: 0.1, exposure: 'well-exposed', noise_level: 'clean', is_screenshot: false, is_graphic: false, orientation: 'landscape' },
      quality_score: 0.85,
      texture_material: ['sand', 'water/reflective'],
      text_content: { has_text: false, text_strings: [], text_role: 'none' },
      description: 'A golden retriever runs along a sandy beach at golden hour.',
      tags: ['dog', 'beach', 'golden hour', 'outdoor'],
    }
    const result = validateMetadata(payload)
    expect(result.subject).toBe('dog on a beach')
    expect(result.objects[0].label).toBe('dog')
    expect(result.mood.energy_level).toBe(0.8)
    expect(result.quality_score).toBe(0.85)
    expect(result.tags).toEqual(['dog', 'beach', 'golden hour', 'outdoor'])
    expect(result.scene.setting).toBe('outdoor')
  })
})
