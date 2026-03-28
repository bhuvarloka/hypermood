'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getImageUrl } from '@/lib/imagekit/url'
import type { GalleryWithImages, Image as ImageRecord } from '@/types/domain'

type ViewMode = 'masonry' | 'timeline'

type Props = {
  gallery: GalleryWithImages
}

export function PublicGalleryView({ gallery }: Props) {
  // Toggle shown only when creator explicitly chose timeline — masonry is single-layout default.
  const supportsTimeline = gallery.layout === 'timeline'
  const initialMode: ViewMode = gallery.layout === 'timeline' ? 'timeline' : 'masonry'
  const [mode, setMode] = useState<ViewMode>(initialMode)

  function switchMode(next: ViewMode) {
    if ('startViewTransition' in document) {
      document.startViewTransition(() => setMode(next))
    } else {
      setMode(next)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-primary-100 flex items-center px-6 py-3">
        <div className="flex-1">
          <span className="text-base font-medium text-primary-900 tracking-tight">Hypermood</span>
        </div>
        <div className="flex-1 flex justify-center">
          <h1 className="text-xl font-medium text-primary-900 truncate max-w-sm">{gallery.name}</h1>
        </div>
        <div className="flex-1 flex justify-end">
          {supportsTimeline && (
            <div className="flex gap-1">
              <ModeButton
                active={mode === 'masonry'}
                onClick={() => switchMode('masonry')}
                label="Masonry view"
              >
                {/* Grid icon */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1" y="1" width="6" height="9" rx="0" fill="currentColor" opacity={mode === 'masonry' ? 1 : 0.4} />
                  <rect x="9" y="1" width="6" height="5" rx="0" fill="currentColor" opacity={mode === 'masonry' ? 1 : 0.4} />
                  <rect x="9" y="8" width="6" height="7" rx="0" fill="currentColor" opacity={mode === 'masonry' ? 1 : 0.4} />
                  <rect x="1" y="12" width="6" height="3" rx="0" fill="currentColor" opacity={mode === 'masonry' ? 1 : 0.4} />
                </svg>
              </ModeButton>
              <ModeButton
                active={mode === 'timeline'}
                onClick={() => switchMode('timeline')}
                label="Timeline view"
              >
                {/* Horizontal strip icon */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1" y="4" width="3" height="8" rx="0" fill="currentColor" opacity={mode === 'timeline' ? 1 : 0.4} />
                  <rect x="6" y="2" width="4" height="12" rx="0" fill="currentColor" opacity={mode === 'timeline' ? 1 : 0.4} />
                  <rect x="12" y="5" width="3" height="6" rx="0" fill="currentColor" opacity={mode === 'timeline' ? 1 : 0.4} />
                </svg>
              </ModeButton>
            </div>
          )}
        </div>
      </header>

      {/* Gallery content */}
      <main className="flex-1">
        {gallery.images.length === 0 ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-lg font-mono text-primary-200">No images in this gallery.</p>
          </div>
        ) : mode === 'masonry' ? (
          <MasonryGrid images={gallery.images} />
        ) : (
          <TimelineStrip images={gallery.images} />
        )}
      </main>
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`p-2 animate-swiss hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-900 ${active ? 'text-primary-900' : 'text-primary-200'}`}
    >
      {children}
    </button>
  )
}

function MasonryGrid({ images }: { images: ImageRecord[] }) {
  return (
    <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-16 p-8 md:p-16">
      {images.map((image, i) => (
        <GalleryImage key={image.id} image={image} index={i} className="break-inside-avoid mb-16" />
      ))}
    </div>
  )
}

function TimelineStrip({ images }: { images: ImageRecord[] }) {
  return (
    <>
      {/* Large screens: horizontal scroll */}
      <div className="hidden md:flex flex-row overflow-x-auto items-center gap-2 px-8 py-16 min-h-screen">
        {images.map((image, i) => (
          <GalleryImage
            key={image.id}
            image={image}
            index={i}
            className="flex-none lg:w-1/4 md:w-1/3"
          />
        ))}
      </div>
      {/* Mobile: vertical stack */}
      <div className="flex md:hidden flex-col gap-2 p-4">
        {images.map((image, i) => (
          <GalleryImage key={image.id} image={image} index={i} className="w-full" />
        ))}
      </div>
    </>
  )
}

function GalleryImage({
  image,
  index,
  className = '',
}: {
  image: ImageRecord
  index: number
  className?: string
}) {
  // Larger transforms for the public gallery — editorial quality
  const src = getImageUrl(image.storage_key, { width: 1200, quality: 85, format: 'webp' })

  const w = image.width ?? 800
  const h = image.height ?? 600

  return (
    <div
      className={`animate-bloom ${className}`}
      style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
    >
      <Image
        src={src}
        alt={image.original_filename ?? ''}
        width={w}
        height={h}
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
        className="w-full h-auto rounded-none"
        unoptimized
        style={{ viewTransitionName: `gallery-image-${image.id}` }}
      />
    </div>
  )
}
