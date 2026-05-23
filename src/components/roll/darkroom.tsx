'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { getImageUrl } from '@/lib/imagekit/url'
import { getImageMetadata } from '@/actions/images'
import type { Image as ImageRecord, BaseLayerMetadata } from '@/types/domain'

type Props = {
  images: ImageRecord[]
  initialIndex: number
  onClose: () => void
}

export function Darkroom({ images, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [isDark, setIsDark] = useState(true)
  const [metadata, setMetadata] = useState<BaseLayerMetadata | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaFailed, setMetaFailed] = useState(false)
  // Track which image the loaded metadata belongs to — avoids stale renders on navigation
  const [metaImageId, setMetaImageId] = useState<string | null>(null)

  const image = images[index]
  const hasPrev = index > 0
  const hasNext = index < images.length - 1

  const goTo = useCallback((i: number) => {
    const update = () => {
      setIndex(i)
      setMetadata(null)
      setMetaImageId(null)
      setMetaFailed(false)
    }
    if ('startViewTransition' in document) {
      document.startViewTransition(update)
    } else {
      update()
    }
  }, [])

  const goPrev = useCallback(() => {
    if (hasPrev) goTo(index - 1)
  }, [hasPrev, index, goTo])

  const goNext = useCallback(() => {
    if (hasNext) goTo(index + 1)
  }, [hasNext, index, goTo])

  const handleClose = useCallback(() => {
    if ('startViewTransition' in document) {
      document.startViewTransition(onClose)
    } else {
      onClose()
    }
  }, [onClose])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleClose, goPrev, goNext])

  // Prevent body scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Fetch metadata on demand (triggered by bottom hover). Catches auth/network errors
  // so the panel degrades gracefully rather than throwing an unhandled rejection.
  const fetchMetadata = useCallback(async (imageId: string) => {
    if (metaImageId === imageId) return
    setMetaLoading(true)
    setMetaFailed(false)
    try {
      const result = await getImageMetadata(imageId)
      setMetadata(result)
      setMetaImageId(imageId)
    } catch {
      setMetaFailed(true)
    } finally {
      setMetaLoading(false)
    }
  }, [metaImageId])

  if (!image) return null

  const src = getImageUrl(image.storage_key, { width: 2000, quality: 90 })
  const bg = isDark ? 'bg-primary-950' : 'bg-white'
  const textColor = isDark ? 'text-primary-200' : 'text-primary-800'

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${bg} transition-colors duration-200`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image detail"
    >
      {/* Stop propagation so only bare background clicks close the overlay */}
      <div
        className="relative w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main image — transition name matches grid cell so the morph works */}
        <Image
          src={src}
          alt={image.original_filename ?? ''}
          width={2000}
          height={2000}
          className="max-w-full max-h-full object-contain"
          style={{ width: 'auto', height: 'auto', maxWidth: '100vw', maxHeight: '100vh', viewTransitionName: `image-${image.id}` }}
          priority
        />

        {/* Dark/light toggle — top-right */}
        <button
          onClick={() => setIsDark((v) => !v)}
          className={`absolute top-4 right-4 text-sm px-3 py-1 animate-swiss ${textColor} hover:opacity-70`}
          aria-label={isDark ? 'Switch to light background' : 'Switch to dark background'}
        >
          {isDark ? '○' : '●'}
        </button>

        {/* Close — top-left */}
        <button
          onClick={handleClose}
          className={`absolute top-4 left-4 text-sm px-3 py-1 animate-swiss ${textColor} hover:opacity-70`}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Prev arrow — revealed on left-edge hover with animate-bloom */}
        {hasPrev && (
          <EdgeHoverZone side="left" onClick={goPrev} textColor={textColor} />
        )}

        {/* Next arrow — revealed on right-edge hover with animate-bloom */}
        {hasNext && (
          <EdgeHoverZone side="right" onClick={goNext} textColor={textColor} />
        )}

        {/* Bottom metadata panel — revealed on bottom-edge hover with animate-bloom */}
        <BottomHoverPanel
          image={image}
          metadata={metadata}
          metaLoading={metaLoading}
          metaFailed={metaFailed}
          textColor={textColor}
          isDark={isDark}
          onEnter={() => fetchMetadata(image.id)}
        />
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EdgeHoverZone({
  side,
  onClick,
  textColor,
}: {
  side: 'left' | 'right'
  onClick: () => void
  textColor: string
}) {
  const [hovered, setHovered] = useState(false)
  const posClass = side === 'left' ? 'left-0' : 'right-0'
  const arrow = side === 'left' ? '←' : '→'

  return (
    <div
      className={`absolute top-0 bottom-0 w-24 ${posClass} flex items-center justify-center cursor-pointer`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      role="button"
      aria-label={side === 'left' ? 'Previous image' : 'Next image'}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {/* Conditional render so animate-bloom fires on every hover entry */}
      {hovered && (
        <span className={`text-3xl font-light animate-bloom ${textColor}`}>
          {arrow}
        </span>
      )}
    </div>
  )
}

function BottomHoverPanel({
  image,
  metadata,
  metaLoading,
  metaFailed,
  textColor,
  isDark,
  onEnter,
}: {
  image: ImageRecord
  metadata: BaseLayerMetadata | null
  metaLoading: boolean
  metaFailed: boolean
  textColor: string
  isDark: boolean
  onEnter: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const panelBg = isDark ? 'bg-primary-950/90' : 'bg-white/90'

  const handleEnter = () => {
    setHovered(true)
    onEnter()
  }

  const capturedDate = image.captured_at
    ? new Date(image.captured_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    // Hover zone covers the full bottom area; onMouseLeave is on the panel itself
    // so the user can move the mouse up to read content without dismissing it.
    <div
      className="absolute bottom-0 inset-x-0 h-24"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Conditional render so animate-bloom fires on every hover entry */}
      {hovered && (
        <div
          className={`absolute bottom-0 inset-x-0 px-8 py-5 animate-bloom ${panelBg}`}
          // Extend the mouse-leave boundary to the panel's actual rendered height
          onMouseLeave={() => setHovered(false)}
        >
          {metaLoading ? (
            <span className={`text-sm tabular-nums text-primary-400`}>Loading…</span>
          ) : metaFailed ? (
            <span className={`text-sm tabular-nums text-primary-400`}>Metadata unavailable</span>
          ) : (
            <div className={`flex flex-wrap gap-x-8 gap-y-2 text-sm tabular-nums ${textColor}`}>
              <span>{image.original_filename}</span>

              {(image.width && image.height) ? (
                <span>{image.width} × {image.height}</span>
              ) : null}

              {capturedDate && <span>{capturedDate}</span>}

              {metadata && (
                <>
                  <span>quality {metadata.quality_score.toFixed(2)}</span>
                  <span>{metadata.scene.setting} · {metadata.scene.time_of_day}</span>
                  {metadata.tags.slice(0, 5).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
