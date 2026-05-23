'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getImageUrl } from '@/lib/imagekit/url'
import { pluralize } from '@/lib/format'
import type { RollWithImageCount } from '@/types/domain'

type Props = {
  roll: RollWithImageCount
  storageKeys: string[]
}

export function RollCard({ roll, storageKeys }: Props) {
  const router = useRouter()
  const [hero, ...rest] = storageKeys
  const small = Array.from({ length: 4 }, (_, i) => rest[i] ?? null)
  const hasAny = storageKeys.length > 0

  const isIndexing = roll.indexed_count > 0 && roll.indexed_count < roll.image_count
  const isPending = roll.indexed_count === 0 && roll.image_count > 0

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    const navigate = () => router.push(`/rolls/${roll.id}`)
    if ('startViewTransition' in document) {
      document.startViewTransition(navigate)
    } else {
      navigate()
    }
  }

  return (
    <a
      href={`/rolls/${roll.id}`}
      onClick={handleClick}
      className="group relative flex flex-col gap-0 overflow-hidden bg-primary-50 animate-swiss hover:bg-primary-100"
      style={{ viewTransitionName: `roll-card-${roll.id}` }}
    >
      {/* Mosaic */}
      <div className="relative w-full aspect-4/3 overflow-hidden bg-primary-100">
        {hasAny ? (
          <>
            {/* Hero — bleeds in on hover */}
            {hero && (
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                <Image
                  src={getImageUrl(hero, { width: 800, quality: 75 })}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
            )}
            {/* 2×2 grid at rest */}
            <div className="grid grid-cols-2 gap-px bg-primary-100 h-full group-hover:opacity-0 transition-opacity duration-300">
              {small.map((key, i) =>
                key ? (
                  <div key={i} className="relative overflow-hidden">
                    <Image
                      src={getImageUrl(key, { width: 400, height: 400, quality: 70 })}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 50vw, 17vw"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div key={i} className="bg-primary-100" />
                ),
              )}
            </div>
          </>
        ) : (
          /* Empty roll — single reference tone */
          <div className="absolute inset-0 flex items-end p-4">
            <span className="text-sm text-primary-300">No images yet</span>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="px-4 py-4">
        <p className="text-2xl font-bold leading-tight truncate">{roll.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm tabular-nums text-primary-400">
            {pluralize(roll.image_count, 'image')}
          </span>
          {isPending && (
            <span className="text-sm text-primary-400">· pending</span>
          )}
          {isIndexing && (
            <span className="text-sm tabular-nums text-primary-400">
              · {roll.indexed_count}/{roll.image_count} indexed
            </span>
          )}
        </div>
      </div>
    </a>
  )
}
