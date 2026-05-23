'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { getImageUrl, getLqipUrl } from '@/lib/imagekit/url'
import type { GalleryWithImages, Image as ImageRecord } from '@/types/domain'
import { Masonry, type MasonryRenderProps } from '@/components/ui/masonry'

type ViewMode = 'masonry' | 'timeline' | 'book' | 'stage'

type Props = {
  gallery: GalleryWithImages
}

function toViewMode(layout: string): ViewMode {
  if (layout === 'timeline' || layout === 'book' || layout === 'stage') return layout
  return 'masonry'
}

export function PublicGalleryView({ gallery }: Props) {
  const initialMode = toViewMode(gallery.layout)
  const [mode, setMode] = useState<ViewMode>(initialMode)
  const [toggleVisible, setToggleVisible] = useState(true)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toggleVisibleRef = useRef(true)

  function switchMode(next: ViewMode) {
    if ('startViewTransition' in document) {
      document.startViewTransition(() => setMode(next))
    } else {
      setMode(next)
    }
  }

  // Fade out mode toggle after 3s of cursor inactivity.
  useEffect(() => {
    function resetIdle() {
      if (!toggleVisibleRef.current) {
        toggleVisibleRef.current = true
        setToggleVisible(true)
      }
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => {
        toggleVisibleRef.current = false
        setToggleVisible(false)
      }, 3000)
    }

    resetIdle()
    window.addEventListener('mousemove', resetIdle)
    window.addEventListener('touchstart', resetIdle)

    return () => {
      window.removeEventListener('mousemove', resetIdle)
      window.removeEventListener('touchstart', resetIdle)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [])

  const rollLabel = gallery.roll_name ? `ROLL — ${gallery.roll_name}` : null

  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {/* ---- Header ---- */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-primary-100">
        <div className="flex items-start px-6 pt-5 pb-4 gap-4">
          <div className="flex-1 flex flex-col gap-0.5 pt-1 min-w-0">
            {rollLabel && (
              <span className="text-xs tracking-widest uppercase text-primary-200 truncate">
                {rollLabel}
              </span>
            )}
            <span className="text-xs text-primary-200 truncate">{gallery.name}</span>
          </div>

          <h1 className="flex-none text-center" style={{ fontSize: 'clamp(2.5rem, 5vw, 3.75rem)', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color: '#18181a' }}>
            {gallery.name}
          </h1>

          <div className="flex-1 flex justify-end pt-1">
            <span className="text-xs text-primary-200 whitespace-nowrap">Made with Hypermood</span>
          </div>
        </div>
      </header>

      {/* ---- Gallery content ---- */}
      <main className={mode === 'stage' ? 'flex-1 overflow-hidden' : 'flex-1'}>
        {gallery.images.length === 0 ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-2xl font-medium text-primary-200">No images in this gallery.</p>
          </div>
        ) : mode === 'timeline' ? (
          <TimelineStrip images={gallery.images} />
        ) : mode === 'book' ? (
          <BookGrid images={gallery.images} />
        ) : mode === 'stage' ? (
          <StageView images={gallery.images} />
        ) : (
          <MasonryGrid images={gallery.images} />
        )}
      </main>

      {/* ---- Floating mode toggle — bottom-center, fades on idle ---- */}
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-1 bg-white/90 backdrop-blur-sm border border-primary-100 p-1 animate-swiss"
        style={{ opacity: toggleVisible ? 1 : 0, pointerEvents: toggleVisible ? 'auto' : 'none' }}
        aria-hidden={!toggleVisible}
      >
        <ModeButton active={mode === 'masonry'} onClick={() => switchMode('masonry')} label="Masonry view">
          <MosaicIcon active={mode === 'masonry'} />
        </ModeButton>
        <ModeButton active={mode === 'timeline'} onClick={() => switchMode('timeline')} label="Timeline view">
          <StripIcon active={mode === 'timeline'} />
        </ModeButton>
        <ModeButton active={mode === 'book'} onClick={() => switchMode('book')} label="Book view">
          <BookIcon active={mode === 'book'} />
        </ModeButton>
        <ModeButton active={mode === 'stage'} onClick={() => switchMode('stage')} label="Stage view">
          <StageIcon active={mode === 'stage'} />
        </ModeButton>
      </div>
    </div>
  )
}

function ModeButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
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

// ---- Mode icons ---- //

function MosaicIcon({ active }: { active: boolean }) {
  const o = active ? 1 : 0.4
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="9" fill="currentColor" opacity={o} />
      <rect x="9" y="1" width="6" height="5" fill="currentColor" opacity={o} />
      <rect x="9" y="8" width="6" height="7" fill="currentColor" opacity={o} />
      <rect x="1" y="12" width="6" height="3" fill="currentColor" opacity={o} />
    </svg>
  )
}

function StripIcon({ active }: { active: boolean }) {
  const o = active ? 1 : 0.4
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="4" width="3" height="8" fill="currentColor" opacity={o} />
      <rect x="6" y="2" width="4" height="12" fill="currentColor" opacity={o} />
      <rect x="12" y="5" width="3" height="6" fill="currentColor" opacity={o} />
    </svg>
  )
}

function BookIcon({ active }: { active: boolean }) {
  const o = active ? 1 : 0.4
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="4" height="7" fill="currentColor" opacity={o} />
      <rect x="7" y="1" width="4" height="4" fill="currentColor" opacity={o} />
      <rect x="7" y="7" width="4" height="8" fill="currentColor" opacity={o} />
      <rect x="13" y="1" width="2" height="14" fill="currentColor" opacity={o} />
      <rect x="1" y="10" width="4" height="5" fill="currentColor" opacity={o} />
    </svg>
  )
}

function StageIcon({ active }: { active: boolean }) {
  const o = active ? 1 : 0.4
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="14" height="12" fill="currentColor" opacity={o} />
      <rect x="6" y="13" width="4" height="1" fill="white" />
    </svg>
  )
}

// ---- Masonry grid ---- //

type GalleryImageRecord = ImageRecord & { subject?: string | null }

function GalleryMasonryCell({ data, width }: MasonryRenderProps<GalleryImageRecord & { index: number }>) {
  const { index, ...image } = data
  return <GalleryImage image={image} index={index} width={width} />
}

function MasonryGrid({ images }: { images: GalleryImageRecord[] }) {
  const items = images.map((img, i) => ({ ...img, index: i }))
  return (
    <Masonry
      items={items}
      getKey={(item) => item.id}
      getAspectRatio={(item) => {
        const w = item.width ?? 1
        const h = item.height ?? 1
        return w / h
      }}
      renderItem={GalleryMasonryCell}
      columnWidth={320}
      gap={64}
      className="p-8 md:p-16"
    />
  )
}

// ---- Book grid — dense ratio-aware masonry, tighter packing ---- //

function BookMasonryCell({ data, width }: MasonryRenderProps<GalleryImageRecord & { index: number }>) {
  const { index, ...image } = data
  return <GalleryImage image={image} index={index} width={width} />
}

function BookGrid({ images }: { images: GalleryImageRecord[] }) {
  const items = images.map((img, i) => ({ ...img, index: i }))
  return (
    <Masonry
      items={items}
      getKey={(item) => item.id}
      getAspectRatio={(item) => {
        const w = item.width ?? 1
        const h = item.height ?? 1
        return w / h
      }}
      renderItem={BookMasonryCell}
      columnWidth={240}
      gap={8}
      className="p-2"
    />
  )
}

// ---- Stage view — one image per viewport, vertical scroll-snap ---- //

function StageView({ images }: { images: GalleryImageRecord[] }) {
  return (
    <div
      className="h-[calc(100vh-var(--header-h,80px))] overflow-y-scroll"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      {images.map((image, i) => (
        <StageCell key={image.id} image={image} index={i} />
      ))}
    </div>
  )
}

function StageCell({ image, index }: { image: GalleryImageRecord; index: number }) {
  const src = getImageUrl(image.storage_key, { width: 1920, quality: 90, format: 'webp' })
  const lqip = getLqipUrl(image.storage_key)
  const w = image.width ?? 1920
  const h = image.height ?? 1080
  const seq = String(index + 1).padStart(3, '0')
  const caption = image.subject ? `${image.subject} — ${seq}` : seq

  // Gradient bleed: each frame bleeds its dominant colour via a subtle vignette
  return (
    <div
      className="relative flex items-center justify-center bg-primary-950"
      style={{
        height: 'calc(100vh - var(--header-h, 80px))',
        scrollSnapAlign: 'start',
      }}
    >
      <Image
        src={src}
        alt={image.original_filename ?? ''}
        width={w}
        height={h}
        sizes="100vw"
        className="max-h-full max-w-full object-contain"
        placeholder="blur"
        blurDataURL={lqip}
        style={{ viewTransitionName: `gallery-image-${image.id}` }}
        priority={index === 0}
      />
      {/* Caption — bottom-center, low contrast */}
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/40 tracking-wide tabular-nums pointer-events-none">
        {caption}
      </p>
    </div>
  )
}

// ---- Timeline strip ---- //

function TimelineStrip({ images }: { images: GalleryImageRecord[] }) {
  return (
    <>
      {/* Large screens: horizontal scroll with baseline anchor */}
      <div
        className="hidden md:flex flex-row overflow-x-auto items-end gap-12 md:gap-16 px-16 py-20 min-h-[80vh]"
        style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
      >
        {images.map((image, i) => (
          <TimelineCell key={image.id} image={image} index={i} />
        ))}
        {/* Trailing spacer so last image doesn't hug the viewport edge */}
        <div className="flex-none w-16 shrink-0" aria-hidden="true" />
      </div>

      {/* Mobile: vertical stack */}
      <div className="flex md:hidden flex-col gap-8 p-4 pb-24">
        {images.map((image, i) => (
          <TimelineCell key={image.id} image={image} index={i} mobile />
        ))}
      </div>
    </>
  )
}

function TimelineCell({
  image,
  index,
  mobile = false,
}: {
  image: GalleryImageRecord
  index: number
  mobile?: boolean
}) {
  const src = getImageUrl(image.storage_key, { width: mobile ? 800 : 1200, quality: 85, format: 'webp' })
  const lqip = getLqipUrl(image.storage_key)
  const w = image.width ?? 800
  const h = image.height ?? 600
  const seq = String(index + 1).padStart(3, '0')
  const caption = image.subject ? `${image.subject} — ${seq}` : seq

  return (
    <div
      className={`flex flex-col animate-bloom ${mobile ? 'gap-2' : 'flex-none gap-3'}`}
      style={{
        ...(!mobile && { width: 'min(28vw, 420px)' }),
        animationDelay: `${Math.min(index * 40, 600)}ms`,
      }}
    >
      <Image
        src={src}
        alt={image.original_filename ?? ''}
        width={w}
        height={h}
        sizes={mobile ? '100vw' : '(min-width: 768px) 28vw, 100vw'}
        className="w-full h-auto rounded-none"
        placeholder="blur"
        blurDataURL={lqip}
        style={{ viewTransitionName: `gallery-image-${image.id}` }}
      />
      <p className="text-xs text-primary-200 tracking-wide">{caption}</p>
    </div>
  )
}

function GalleryImage({ image, index, width: renderWidth }: { image: GalleryImageRecord; index: number; width?: number }) {
  const src = getImageUrl(image.storage_key, { width: 1200, quality: 85, format: 'webp' })
  const lqip = getLqipUrl(image.storage_key)
  const w = image.width ?? 800
  const h = image.height ?? 600
  const cellHeight = renderWidth ? Math.round((renderWidth / w) * h) : undefined

  return (
    <div className="animate-bloom" style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}>
      <Image
        src={src}
        alt={image.original_filename ?? ''}
        width={w}
        height={h}
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
        className="w-full h-auto rounded-none"
        placeholder="blur"
        blurDataURL={lqip}
        style={{
          viewTransitionName: `gallery-image-${image.id}`,
          ...(cellHeight ? { height: cellHeight } : {}),
        }}
      />
    </div>
  )
}
