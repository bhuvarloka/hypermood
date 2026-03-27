'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { createGallery } from '@/actions/galleries'
import { getImageUrl } from '@/lib/imagekit/url'
import type { GalleryLayout, Image as ImageRecord } from '@/types/domain'

type Props = {
  images: ImageRecord[]
  rollId: string
  onClose: () => void
  onGallerySaved: (slug: string) => void
}

export function PreviewPanel({ images, rollId, onClose, onGallerySaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [saveFormOpen, setSaveFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [layout, setLayout] = useState<GalleryLayout>('masonry')
  const [isPublic, setIsPublic] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Drag-to-dismiss: track live delta in a ref so callbacks never read stale state.
  // State is used only to apply the CSS transform for the visual follow.
  const dragStartY = useRef<number | null>(null)
  const dragDelta = useRef(0)
  const [translateY, setTranslateY] = useState(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleHandlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY
    dragDelta.current = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handleHandlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return
    const delta = e.clientY - dragStartY.current
    if (delta > 0) {
      dragDelta.current = delta
      setTranslateY(delta)
    }
  }, [])

  const handleHandlePointerUp = useCallback(() => {
    // Read the live ref value — never stale regardless of render timing
    if (dragDelta.current > 80) {
      onClose()
    } else {
      setTranslateY(0)
    }
    dragStartY.current = null
    dragDelta.current = 0
  }, [onClose])

  const handleSave = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const gallery = await createGallery(
        rollId,
        trimmed,
        images.map((img) => img.id),
        null,
        layout,
        isPublic,
      )
      onGallerySaved(gallery.slug)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save gallery')
    } finally {
      setSaving(false)
    }
  }, [rollId, images, name, layout, isPublic, onGallerySaved, onClose])

  return (
    // Backdrop — clicking above the panel (i.e. the flex-1 area) closes it
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Preview selection"
    >
      <div className="flex-1 bg-primary-950/40" />

      {/* Panel — fixed positioning per spec; flex column so content fills without calc() */}
      <div
        className="fixed bottom-0 inset-x-0 h-[60vh] bg-white flex flex-col animate-bloom"
        style={{
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          transition: translateY > 0 ? 'none' : 'transform 150ms ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — pointer handlers confined here so scrolling the image grid never triggers dismiss */}
        <div
          className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab select-none"
          onPointerDown={handleHandlePointerDown}
          onPointerMove={handleHandlePointerMove}
          onPointerUp={handleHandlePointerUp}
          onPointerCancel={handleHandlePointerUp}
        >
          <div className="w-10 h-1 bg-primary-200" />
        </div>

        {/* Header row */}
        <div className="px-8 pb-4 flex items-start justify-between gap-4 shrink-0">
          <span className="text-xl font-medium">{images.length} images</span>

          {saveFormOpen ? (
            <SaveForm
              name={name}
              layout={layout}
              isPublic={isPublic}
              saving={saving}
              error={error}
              onNameChange={setName}
              onLayoutChange={setLayout}
              onPublicChange={setIsPublic}
              onSubmit={handleSave}
              onCancel={() => { setSaveFormOpen(false); setError(null) }}
            />
          ) : (
            <button
              onClick={() => setSaveFormOpen(true)}
              className="shrink-0 bg-primary-900 text-white rounded-xl text-base font-medium px-4 py-2 animate-swiss hover:bg-primary-800"
            >
              Save as Gallery
            </button>
          )}
        </div>

        {/* Image grid — flex-1 so it fills remaining panel height without a magic calc() */}
        <div className="px-8 flex-1 overflow-y-auto">
          <div className="columns-3 sm:columns-4 gap-x-1">
            {images.map((img, i) => {
              const src = getImageUrl(img.storage_key, { width: 400, quality: 80 })
              return (
                <div
                  key={img.id}
                  className="break-inside-avoid mb-1 animate-bloom"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <Image
                    src={src}
                    alt={img.original_filename ?? ''}
                    width={400}
                    height={300}
                    unoptimized
                    className="w-full rounded-none object-cover"
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function SaveForm({
  name,
  layout,
  isPublic,
  saving,
  error,
  onNameChange,
  onLayoutChange,
  onPublicChange,
  onSubmit,
  onCancel,
}: {
  name: string
  layout: GalleryLayout
  isPublic: boolean
  saving: boolean
  error: string | null
  onNameChange: (v: string) => void
  onLayoutChange: (v: GalleryLayout) => void
  onPublicChange: (v: boolean) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-2 flex-1 max-w-sm animate-bloom">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit() }}
          placeholder="Gallery name"
          autoFocus
          disabled={saving}
          className="flex-1 text-base border border-primary-200 rounded-none px-3 py-2 outline-none focus:ring-2 focus:ring-primary-900 disabled:opacity-50"
        />
        <button
          onClick={onSubmit}
          disabled={saving || !name.trim()}
          className="shrink-0 bg-primary-900 text-white rounded-xl text-base font-medium px-4 py-2 animate-swiss hover:bg-primary-800 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="shrink-0 text-base font-mono text-primary-400 px-2 py-2 animate-swiss hover:text-primary-900 disabled:opacity-50"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="flex gap-1 text-base font-mono">
          {(['masonry', 'timeline'] as GalleryLayout[]).map((opt) => (
            <button
              key={opt}
              onClick={() => onLayoutChange(opt)}
              disabled={saving}
              className={`px-3 py-1 border animate-swiss ${
                layout === opt
                  ? 'border-primary-900 bg-primary-900 text-white'
                  : 'border-primary-200 text-primary-600 hover:bg-primary-50'
              } disabled:opacity-50`}
            >
              {opt}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPublicChange(!isPublic)}
          disabled={saving}
          className={`text-base font-mono px-3 py-1 border animate-swiss ${
            isPublic
              ? 'border-primary-900 bg-primary-900 text-white'
              : 'border-primary-200 text-primary-600 hover:bg-primary-50'
          } disabled:opacity-50`}
        >
          {isPublic ? 'public' : 'private'}
        </button>
      </div>

      {error && (
        <span className="text-base font-mono text-semantic-alert">{error}</span>
      )}
    </div>
  )
}
