'use client'

import { useCallback, useState } from 'react'

type Props = {
  slug: string
  className?: string
  label?: string
}

export function CopyLinkButton({ slug, className, label = 'copy link' }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/g/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [slug])

  return (
    <button
      type="button"
      onClick={copy}
      className={className ?? 'text-sm text-primary-400 animate-swiss hover:text-primary-900 shrink-0'}
      aria-label="Copy public link"
    >
      {copied ? 'copied!' : label}
    </button>
  )
}
