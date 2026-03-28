import { describe, it, expect } from 'vitest'
import { derivePreviewImages, GALLERY_INTENT_RE } from '@/components/chat/chat-interface.logic'
import type { Image as ImageRecord } from '@/types/domain'

// Minimal stub that satisfies ImageRecord for testing
function img(id: string): ImageRecord {
  return {
    id,
    roll_id: 'roll-1',
    user_id: 'user-1',
    storage_key: `keys/${id}`,
    original_filename: `${id}.jpg`,
    file_size_bytes: 1000,
    mime_type: 'image/jpeg',
    width: 800,
    height: 600,
    captured_at: null,
    uploaded_at: new Date().toISOString(),
    status: 'indexed',
    error_message: null,
  }
}

const A = img('a'), B = img('b'), C = img('c'), D = img('d')

function makeMap(images: ImageRecord[]): Map<string, ImageRecord> {
  return new Map(images.map((i) => [i.id, i]))
}

// ---------------------------------------------------------------------------
// derivePreviewImages — priority rules
// ---------------------------------------------------------------------------

describe('derivePreviewImages — selection takes priority', () => {
  it('returns selected images when both selected and result sets exist', () => {
    const result = derivePreviewImages({
      selectedImageIds: ['a', 'b'],
      resultImageIds: ['c', 'd'],
      liveImages: [A, B, C, D],
      imageMap: makeMap([A, B, C, D]),
    })
    expect(result.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('preserves the order of selectedImageIds (not liveImages order)', () => {
    const result = derivePreviewImages({
      selectedImageIds: ['b', 'a'],
      resultImageIds: null,
      liveImages: [A, B],
      imageMap: makeMap([A, B]),
    })
    expect(result.map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('skips selectedImageIds that are not in imageMap', () => {
    // Image 'x' was uploaded after the map was built
    const result = derivePreviewImages({
      selectedImageIds: ['a', 'x'],
      resultImageIds: null,
      liveImages: [A],
      imageMap: makeMap([A]),
    })
    expect(result.map((i) => i.id)).toEqual(['a'])
    // Must not throw or return undefined entries
    expect(result.every(Boolean)).toBe(true)
  })
})

describe('derivePreviewImages — result set fallback', () => {
  it('returns result images when no selection and resultImageIds exist', () => {
    const result = derivePreviewImages({
      selectedImageIds: [],
      resultImageIds: ['c', 'd'],
      liveImages: [A, B, C, D],
      imageMap: makeMap([A, B, C, D]),
    })
    expect(result.map((i) => i.id)).toEqual(['c', 'd'])
  })

  it('falls through to liveImages when resultImageIds is empty array', () => {
    // An empty result set (query returned nothing) must show liveImages fallback,
    // NOT an empty preview — that would prevent the user from saving/previewing.
    const result = derivePreviewImages({
      selectedImageIds: [],
      resultImageIds: [],
      liveImages: [A, B],
      imageMap: makeMap([A, B]),
    })
    expect(result.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('falls through to liveImages when resultImageIds is null', () => {
    const result = derivePreviewImages({
      selectedImageIds: [],
      resultImageIds: null,
      liveImages: [A, B, C],
      imageMap: makeMap([A, B, C]),
    })
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('skips resultImageIds missing from imageMap', () => {
    const result = derivePreviewImages({
      selectedImageIds: [],
      resultImageIds: ['a', 'missing'],
      liveImages: [A],
      imageMap: makeMap([A]),
    })
    expect(result.map((i) => i.id)).toEqual(['a'])
    expect(result.every(Boolean)).toBe(true)
  })
})

describe('derivePreviewImages — full roll fallback', () => {
  it('returns all liveImages when nothing is selected and no results', () => {
    const result = derivePreviewImages({
      selectedImageIds: [],
      resultImageIds: null,
      liveImages: [A, B, C],
      imageMap: makeMap([A, B, C]),
    })
    expect(result).toEqual([A, B, C])
  })

  it('returns empty array when liveImages is empty', () => {
    const result = derivePreviewImages({
      selectedImageIds: [],
      resultImageIds: null,
      liveImages: [],
      imageMap: new Map(),
    })
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// GALLERY_INTENT_RE
// ---------------------------------------------------------------------------

describe('GALLERY_INTENT_RE', () => {
  const matches = [
    'show galleries',
    'show my galleries',
    'open gallery',
    'open galleries',
    'view galleries',
    'see my gallery',
    'list all galleries',
    'show me my galleries',
    'open the gallery',
  ]

  const nonMatches = [
    'show my portraits',
    'gallery saved',       // passive, no intent verb
    'find portraits',
    'open the darkroom',
    'view images',
    'save as gallery',     // "gallery" present but no intent verb preceding
  ]

  for (const text of matches) {
    it(`matches: "${text}"`, () => {
      expect(GALLERY_INTENT_RE.test(text)).toBe(true)
    })
  }

  for (const text of nonMatches) {
    it(`does NOT match: "${text}"`, () => {
      expect(GALLERY_INTENT_RE.test(text)).toBe(false)
    })
  }

  it('is case-insensitive', () => {
    expect(GALLERY_INTENT_RE.test('SHOW GALLERIES')).toBe(true)
    expect(GALLERY_INTENT_RE.test('Show My Galleries')).toBe(true)
  })
})
