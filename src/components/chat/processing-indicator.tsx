'use client'

import { useEffect, useState } from 'react'
import { buildLines } from './processing-indicator.logic'

type Props = {
  isImagePrompt: boolean
  imageCount: number
  // When defined, the "Found M matches" terminal line is revealed.
  matchCount?: number
}

export function ProcessingIndicator({ isImagePrompt, imageCount, matchCount }: Props) {
  const lines = buildLines({ isImagePrompt, imageCount, matchCount })

  // Each line blooms in with a 100ms stagger.
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    setVisibleCount(1)
    const timers = lines.slice(1).map((_, i) =>
      setTimeout(() => setVisibleCount(i + 2), (i + 1) * 100),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImagePrompt])

  // When matchCount arrives, immediately reveal the final line without waiting
  // for the stagger — it's the resolution signal, not part of the intro sequence.
  useEffect(() => {
    if (matchCount !== undefined) setVisibleCount(lines.length)
  }, [matchCount, lines.length])

  return (
    <div className="flex justify-start">
      <div className="max-w-[70%] bg-white text-lg px-4 py-3 rounded-2xl border border-primary-100 flex flex-col gap-1">
        {lines.slice(0, visibleCount).map((line) => (
          <span key={line} className="animate-bloom block text-sm text-primary-400">
            {line}
          </span>
        ))}
      </div>
    </div>
  )
}
