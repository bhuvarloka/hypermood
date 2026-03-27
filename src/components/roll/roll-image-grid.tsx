'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getImageUrl } from '@/lib/imagekit/url'
import type { Image as ImageRecord } from '@/types/domain'

type Props = {
  rollId: string
  initialImages: ImageRecord[]
  resultImageIds?: string[] | null
  selectedImageIds?: string[]
  onImageClick?: (id: string) => void
  onImagesChange?: (images: ImageRecord[]) => void
  onFullscreen?: (imageId: string, contextImages: ImageRecord[]) => void
}

export function RollImageGrid({
  rollId,
  initialImages,
  resultImageIds = null,
  selectedImageIds = [],
  onImageClick,
  onImagesChange,
  onFullscreen,
}: Props) {
  const [images, setImages] = useState<ImageRecord[]>(initialImages)
  const bufferRef = useRef<ImageRecord[]>([])
  const rafIdRef = useRef<number | null>(null)
  const onImagesChangeRef = useRef(onImagesChange)
  onImagesChangeRef.current = onImagesChange

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`roll-images-${rollId}`)
      .on(
        'postgres_changes',
        {
          // UPDATE only — INSERT is covered by initial server fetch + upload response;
          // DELETE on payload.new is {} which would corrupt the grid map
          event: 'UPDATE',
          schema: 'public',
          table: 'images',
          filter: `roll_id=eq.${rollId}`,
        },
        (payload) => {
          const updated = payload.new as ImageRecord

          bufferRef.current.push(updated)

          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(() => {
              const buffered = bufferRef.current.splice(0)
              rafIdRef.current = null

              setImages((prev) => {
                const map = new Map(prev.map((img) => [img.id, img]))
                for (const img of buffered) map.set(img.id, img)
                const next = Array.from(map.values())
                onImagesChangeRef.current?.(next)
                return next
              })
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
        bufferRef.current.splice(0)
      }
    }
  }, [rollId])

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 py-20">
        <p className="text-lg font-mono">No images yet. Drag files here to index.</p>
      </div>
    )
  }

  const resultSet = resultImageIds !== null ? new Set(resultImageIds) : null
  const selectedSet = new Set(selectedImageIds)

  // Context-aware navigation: Darkroom navigates within the active result set (or all images).
  const contextImages =
    resultSet !== null ? images.filter((img) => resultSet.has(img.id)) : images

  return (
    <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-1 p-4">
      {images.map((image) => {
        const isResult = resultSet === null || resultSet.has(image.id)
        const isSelected = selectedSet.has(image.id)

        const opacity = resultSet !== null && !isResult && !isSelected ? 0.15 : 1

        return (
          <ImageCell
            key={image.id}
            image={image}
            opacity={opacity}
            isSelected={isSelected}
            onClick={onImageClick}
            onFullscreen={onFullscreen ? () => onFullscreen(image.id, contextImages) : undefined}
          />
        )
      })}
    </div>
  )
}

type ImageCellProps = {
  image: ImageRecord
  opacity: number
  isSelected: boolean
  onClick?: (id: string) => void
  onFullscreen?: () => void
}

function ImageCell({ image, opacity, isSelected, onClick, onFullscreen }: ImageCellProps) {
  const src = getImageUrl(image.storage_key, { width: 400, quality: 80 })

  const handleActivate = () => onClick?.(image.id)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.(image.id)
    }
  }

  const ringClass = isSelected ? 'ring-2 ring-semantic-info ring-offset-2' : ''

  return (
    // stable DOM node — transition-opacity only, never unmounts
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      className={`group relative break-inside-avoid mb-1 rounded-none transition-opacity duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-primary-900 cursor-pointer ${ringClass}`}
      style={{ opacity }}
    >
      <Image
        src={src}
        alt={image.original_filename ?? ''}
        width={400}
        height={0}
        sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        className="w-full h-auto rounded-none"
        unoptimized
        style={{ height: 'auto' }}
      />

      {/* Fullscreen icon — absolutely positioned, zero layout shift, click isolated from select */}
      {onFullscreen && (
        <button
          onClick={(e) => { e.stopPropagation(); onFullscreen() }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 animate-bloom pointer-events-auto flex items-center justify-center w-7 h-7 bg-black/40 hover:bg-black/60 animate-swiss"
          aria-label="Open fullscreen"
          tabIndex={-1}
        >
          <span className="text-white text-base leading-none">⤢</span>
        </button>
      )}
    </div>
  )
}
