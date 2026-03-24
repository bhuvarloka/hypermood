import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@imagekit/next', () => ({
  buildSrc: vi.fn(({ urlEndpoint, src, transformation }) =>
    `${urlEndpoint}/${src}${transformation ? '?t=1' : ''}`
  ),
}))

import { buildSrc } from '@imagekit/next'
import { getImageUrl } from '@/lib/imagekit/url'

const mockBuildSrc = buildSrc as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockBuildSrc.mockClear()
  vi.unstubAllEnvs()
})

describe('getImageUrl', () => {
  it('throws when NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT is not set', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT', '')
    expect(() => getImageUrl('photo.jpg')).toThrow('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT is not configured')
  })

  it('throws when NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT env var is absent (undefined)', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT', undefined as unknown as string)
    expect(() => getImageUrl('photo.jpg')).toThrow('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT is not configured')
  })

  it('calls buildSrc with transformation: undefined when no transforms given', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT', 'https://ik.imagekit.io/demo')
    getImageUrl('photo.jpg')
    expect(mockBuildSrc).toHaveBeenCalledWith(
      expect.objectContaining({ transformation: undefined }),
    )
  })

  it('passes full transforms as a single-element array', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT', 'https://ik.imagekit.io/demo')
    getImageUrl('photo.jpg', { width: 800, height: 600, quality: 80, format: 'webp' })
    expect(mockBuildSrc).toHaveBeenCalledWith(
      expect.objectContaining({
        transformation: [{ width: 800, height: 600, quality: 80, format: 'webp' }],
      }),
    )
  })

  it('passes partial transforms with undefined for missing fields', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT', 'https://ik.imagekit.io/demo')
    getImageUrl('photo.jpg', { width: 400 })
    expect(mockBuildSrc).toHaveBeenCalledWith(
      expect.objectContaining({
        transformation: [{ width: 400, height: undefined, quality: undefined, format: undefined }],
      }),
    )
  })

  it('passes the storage key as src to buildSrc', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT', 'https://ik.imagekit.io/demo')
    getImageUrl('rolls/abc/photo.jpg')
    expect(mockBuildSrc).toHaveBeenCalledWith(
      expect.objectContaining({ src: 'rolls/abc/photo.jpg' }),
    )
  })

  it('passes the correct urlEndpoint to buildSrc', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT', 'https://ik.imagekit.io/demo')
    getImageUrl('photo.jpg')
    expect(mockBuildSrc).toHaveBeenCalledWith(
      expect.objectContaining({ urlEndpoint: 'https://ik.imagekit.io/demo' }),
    )
  })

  it('returns whatever buildSrc returns', () => {
    vi.stubEnv('NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT', 'https://ik.imagekit.io/demo')
    mockBuildSrc.mockReturnValueOnce('https://ik.imagekit.io/demo/photo.jpg')
    const result = getImageUrl('photo.jpg')
    expect(result).toBe('https://ik.imagekit.io/demo/photo.jpg')
  })
})
