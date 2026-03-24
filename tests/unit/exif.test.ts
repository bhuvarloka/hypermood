import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('exifr', () => ({ parse: vi.fn() }))

import { parse } from 'exifr'
import { extractExif } from '@/lib/exif/extract'

const mockParse = parse as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockParse.mockReset()
})

describe('extractExif', () => {
  it('returns all fields populated from valid EXIF tags', async () => {
    const date = new Date('2024-06-15T10:30:00Z')
    mockParse.mockResolvedValue({ DateTimeOriginal: date, ExifImageWidth: 4000, ExifImageHeight: 3000 })
    const result = await extractExif(Buffer.from([]))
    expect(result.capturedAt).toBe(date)
    expect(result.width).toBe(4000)
    expect(result.height).toBe(3000)
  })

  it('returns null fields when parse returns null', async () => {
    mockParse.mockResolvedValue(null)
    const result = await extractExif(Buffer.from([]))
    expect(result).toEqual({ capturedAt: null, width: null, height: null })
  })

  it('returns capturedAt null when DateTimeOriginal is a string (not a Date)', async () => {
    mockParse.mockResolvedValue({ DateTimeOriginal: '2024:06:15 10:30:00', ExifImageWidth: 4000, ExifImageHeight: 3000 })
    const result = await extractExif(Buffer.from([]))
    expect(result.capturedAt).toBeNull()
    expect(result.width).toBe(4000)
  })

  it('returns width null when ExifImageWidth is a string', async () => {
    mockParse.mockResolvedValue({ DateTimeOriginal: new Date(), ExifImageWidth: '4000', ExifImageHeight: 3000 })
    const result = await extractExif(Buffer.from([]))
    expect(result.width).toBeNull()
  })

  it('returns height null when ExifImageHeight is a string', async () => {
    mockParse.mockResolvedValue({ DateTimeOriginal: new Date(), ExifImageWidth: 4000, ExifImageHeight: '3000' })
    const result = await extractExif(Buffer.from([]))
    expect(result.height).toBeNull()
  })

  it('returns all null when parse throws', async () => {
    mockParse.mockRejectedValue(new Error('Malformed EXIF'))
    const result = await extractExif(Buffer.from([]))
    expect(result).toEqual({ capturedAt: null, width: null, height: null })
  })

  it('returns null for missing fields when only width is present', async () => {
    mockParse.mockResolvedValue({ ExifImageWidth: 1920 })
    const result = await extractExif(Buffer.from([]))
    expect(result.capturedAt).toBeNull()
    expect(result.width).toBe(1920)
    expect(result.height).toBeNull()
  })

  it('calls parse with correct pick options', async () => {
    mockParse.mockResolvedValue(null)
    await extractExif(Buffer.from([1, 2, 3]))
    expect(mockParse).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        pick: ['DateTimeOriginal', 'ExifImageWidth', 'ExifImageHeight'],
        reviveValues: true,
      }),
    )
  })
})
