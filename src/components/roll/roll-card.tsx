import Link from 'next/link'
import Image from 'next/image'
import { getImageUrl } from '@/lib/imagekit/url'
import type { RollWithImageCount } from '@/types/domain'

type Props = {
  roll: RollWithImageCount
  storageKeys: string[]
}

export function RollCard({ roll, storageKeys }: Props) {
  const slots = Array.from({ length: 4 }, (_, i) => storageKeys[i] ?? null)
  const isPending = roll.indexed_count === 0 && roll.image_count > 0
  const isIndexing = roll.indexed_count > 0 && roll.indexed_count < roll.image_count
  const isComplete = roll.image_count > 0 && roll.indexed_count === roll.image_count

  return (
    <Link
      href={`/rolls/${roll.id}`}
      className="flex items-center gap-6 py-4 animate-swiss hover:bg-primary-50 -mx-10 px-10"
    >
      {/* 2×2 thumbnail mosaic */}
      <div className="grid grid-cols-2 gap-px bg-primary-100 w-16 h-16 shrink-0">
        {slots.map((key, i) =>
          key ? (
            <div key={i} className="relative w-full h-full overflow-hidden">
              <Image
                src={getImageUrl(key, { width: 200, height: 200, quality: 70 })}
                alt=""
                fill
                sizes="32px"
                className="object-cover"
              />
            </div>
          ) : (
            <div key={i} className="bg-primary-100" />
          ),
        )}
      </div>

      {/* Roll name + stats */}
      <div className="flex-1 min-w-0">
        <p className="text-3xl font-medium truncate">{roll.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm tracking-tight tabular-nums text-primary-400">
            {roll.image_count.toLocaleString()} {roll.image_count === 1 ? 'image' : 'images'}
          </span>
          {isPending && (
            <span className="text-sm tracking-tight tabular-nums text-primary-400">· pending</span>
          )}
          {isIndexing && (
            <span className="text-sm tracking-tight tabular-nums text-primary-400">
              · {roll.indexed_count}/{roll.image_count} indexed
            </span>
          )}
          {isComplete && (
            <span className="text-sm tracking-tight tabular-nums text-primary-400">· {roll.indexed_count.toLocaleString()} indexed</span>
          )}
        </div>
      </div>
    </Link>
  )
}
