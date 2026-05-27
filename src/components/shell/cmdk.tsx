'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listGalleriesWithImageData } from '@/actions/galleries'
import { pluralImages } from '@/actions/gallery.logic'
import { ThumbMosaic } from '@/components/ui/thumb-mosaic'
import type { RollWithImageCount, GalleryListItem } from '@/types/domain'
import type { RollThumbnailMap } from '@/lib/rolls/thumbnails'

type Props = {
  open: boolean
  onClose: () => void
  rolls: RollWithImageCount[]
  rollThumbnails: RollThumbnailMap
}

type Item = {
  kind: 'roll' | 'gallery'
  id: string
  name: string
  thumbnails: string[]
  subtitle: string
  href: string
}

export function CmdK({ open, onClose, rolls, rollThumbnails }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [galleries, setGalleries] = useState<GalleryListItem[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || galleries !== null) return
    let cancelled = false
    listGalleriesWithImageData()
      .then((data) => { if (!cancelled) setGalleries(data) })
      .catch(() => { if (!cancelled) setGalleries([]) })
    return () => { cancelled = true }
  }, [open, galleries])

  const filtered = useMemo(() => {
    const items: Item[] = [
      ...rolls.map<Item>((r) => ({
        kind: 'roll',
        id: r.id,
        name: r.name,
        thumbnails: rollThumbnails[r.id] ?? [],
        subtitle: pluralImages(r.image_count),
        href: `/rolls/${r.id}`,
      })),
      ...(galleries ?? []).map<Item>((g) => ({
        kind: 'gallery',
        id: g.id,
        name: g.name,
        thumbnails: g.thumbnail_keys,
        subtitle: pluralImages(g.image_count),
        href: `/galleries/${g.id}`,
      })),
    ]
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => it.name.toLowerCase().includes(q))
  }, [rolls, rollThumbnails, galleries, query])

  const groups = useMemo(() => {
    const rollItems: { it: Item; idx: number }[] = []
    const galleryItems: { it: Item; idx: number }[] = []
    filtered.forEach((it, idx) => {
      if (it.kind === 'roll') rollItems.push({ it, idx })
      else galleryItems.push({ it, idx })
    })
    return { rolls: rollItems, galleries: galleryItems }
  }, [filtered])

  const filteredRef = useRef(filtered)
  filteredRef.current = filtered
  const activeRef = useRef(active)
  activeRef.current = active

  // Restore focus to whatever was focused before the dialog opened (the
  // "Open switcher" button or the element the ⌘K shortcut fired from).
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null
      setQuery('')
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      restoreFocusRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, Math.max(filteredRef.current.length - 1, 0)))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = filteredRef.current[activeRef.current]
        if (!item) return
        onClose()
        router.push(item.href)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, router])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const activeItem = filtered[active] ?? null
  const navigate = (href: string) => {
    onClose()
    router.push(href)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center sm:pt-[15vh] sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Switcher"
    >
      <button
        type="button"
        aria-label="Close switcher"
        onClick={onClose}
        className="absolute inset-0 bg-primary-950/30 cursor-default"
      />
      {/* Full-screen sheet on mobile; centered card on sm+. */}
      <div className="relative w-full h-full sm:h-auto sm:max-w-xl bg-white sm:rounded-xl overflow-hidden animate-bloom shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to roll or gallery…"
          role="combobox"
          aria-label="Search rolls and galleries"
          aria-expanded="true"
          aria-controls="cmdk-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeItem ? `cmdk-opt-${activeItem.kind}-${activeItem.id}` : undefined}
          className="w-full px-5 py-4 text-lg outline-none border-b border-primary-100 placeholder:text-primary-500"
        />
        <div
          ref={listRef}
          id="cmdk-listbox"
          role="listbox"
          aria-label="Rolls and galleries"
          className="h-[calc(100%-3.75rem)] sm:h-auto sm:max-h-[50vh] overflow-y-auto py-2"
        >
          {filtered.length === 0 ? (
            <div className="px-5 py-6 text-base text-primary-500">No matches</div>
          ) : (
            <>
              <Section
                label="Rolls"
                items={groups.rolls}
                activeId={activeItem?.id ?? null}
                onSelect={navigate}
              />
              <Section
                label="Galleries"
                items={groups.galleries}
                activeId={activeItem?.id ?? null}
                onSelect={navigate}
              />
            </>
          )}
        </div>
      </div>

      {/* Screen-reader-only running count of matches. */}
      <div aria-live="polite" className="sr-only">
        {galleries === null
          ? 'Loading…'
          : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`}
      </div>
    </div>
  )
}

function Section({
  label,
  items,
  activeId,
  onSelect,
}: {
  label: string
  items: { it: Item; idx: number }[]
  activeId: string | null
  onSelect: (href: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-1" role="group" aria-label={label}>
      <div className="px-5 pt-2 pb-1 text-sm tracking-tight text-primary-500" aria-hidden="true">
        {label}
      </div>
      {items.map(({ it, idx }) => {
        const isActive = it.id === activeId
        return (
          <div
            key={`${it.kind}-${it.id}`}
            id={`cmdk-opt-${it.kind}-${it.id}`}
            role="option"
            aria-selected={isActive}
            data-idx={idx}
            onClick={() => onSelect(it.href)}
            className={`w-full flex items-center gap-4 px-5 py-2.5 text-left cursor-pointer animate-swiss ${
              isActive ? 'bg-primary-100' : 'hover:bg-primary-50'
            }`}
          >
            <ThumbMosaic storageKeys={it.thumbnails} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-base text-primary-900 truncate">{it.name}</div>
              <div className="text-sm tabular-nums text-primary-500">{it.subtitle}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
