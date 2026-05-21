import { getImageUrl } from '@/lib/imagekit/url'

type Props = {
  storageKeys: string[]
  size: number
  className?: string
}

export function ThumbMosaic({ storageKeys, size, className }: Props) {
  const cell = Math.round(size / 2)
  return (
    <div
      className={`grid grid-cols-2 gap-px shrink-0 bg-primary-100 ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      {Array.from({ length: 4 }, (_, i) => {
        const key = storageKeys[i]
        return key ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={getImageUrl(key, { width: cell, height: cell, quality: 60 })}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div key={i} className="bg-primary-100" />
        )
      })}
    </div>
  )
}
