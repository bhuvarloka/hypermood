'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'
import { GalleryDrawer } from '@/components/gallery/gallery-drawer'
import { CmdK } from './cmdk'
import type { RollWithImageCount } from '@/types/domain'
import type { RollThumbnailMap } from '@/lib/rolls/thumbnails'

type Props = {
  rolls: RollWithImageCount[]
  rollThumbnails: RollThumbnailMap
  userEmail: string
}

export function TopBar({ rolls, rollThumbnails, userEmail }: Props) {
  const pathname = usePathname()
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [galleriesOpen, setGalleriesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdkOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const openGalleries = () => setGalleriesOpen(true)
    const openCmdk = () => setCmdkOpen(true)
    window.addEventListener('hypermood:open-galleries', openGalleries)
    window.addEventListener('hypermood:open-cmdk', openCmdk)
    return () => {
      window.removeEventListener('hypermood:open-galleries', openGalleries)
      window.removeEventListener('hypermood:open-cmdk', openCmdk)
    }
  }, [])

  useEffect(() => {
    if (!settingsOpen) return
    const onClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [settingsOpen])

  const breadcrumb = getBreadcrumb(pathname, rolls)

  return (
    <>
      <header className="flex items-center h-14 shrink-0 px-6 bg-white border-b border-primary-100">
        <div className="flex-1 flex items-center min-w-0 relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="text-base font-medium text-primary-900 animate-swiss hover:text-primary-800"
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
          >
            Hypermood
          </button>

          {settingsOpen && (
            <div
              role="menu"
              className="absolute top-10 left-0 z-40 min-w-56 bg-white rounded-xl py-2 animate-bloom shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
            >
              <div className="px-4 py-2 text-sm tracking-tight text-primary-500 truncate">
                {userEmail}
              </div>
              <Link
                href="/rolls"
                onClick={() => setSettingsOpen(false)}
                className="block px-4 py-2 text-base text-primary-900 hover:bg-primary-50"
                role="menuitem"
              >
                Rolls
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false)
                  setGalleriesOpen(true)
                }}
                className="block w-full text-left px-4 py-2 text-base text-primary-900 hover:bg-primary-50"
                role="menuitem"
              >
                Galleries
              </button>
              <form action={signOut}>
                <button
                  type="submit"
                  className="block w-full text-left px-4 py-2 text-base text-primary-900 hover:bg-primary-50"
                  role="menuitem"
                >
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>

        <nav
          aria-label="Breadcrumb"
          className="flex-1 flex items-center justify-center text-base text-primary-900 min-w-0"
        >
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center min-w-0">
              {i > 0 && (
                <span className="mx-2 text-primary-200" aria-hidden="true">
                  ›
                </span>
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate animate-swiss hover:text-primary-800"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate text-primary-500">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex-1 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setCmdkOpen(true)}
            aria-label="Open switcher"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-500 rounded-full bg-primary-50 animate-swiss hover:bg-primary-100 hover:text-primary-900"
          >
            <span>Jump to…</span>
            <kbd className="text-sm tracking-tight tabular-nums text-primary-500">
              ⌘K
            </kbd>
          </button>
        </div>
      </header>

      <CmdK
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        rolls={rolls}
        rollThumbnails={rollThumbnails}
      />

      {galleriesOpen && (
        <GalleryDrawer onClose={() => setGalleriesOpen(false)} />
      )}
    </>
  )
}

type Crumb = { label: string; href?: string }

function getBreadcrumb(pathname: string, rolls: RollWithImageCount[]): Crumb[] {
  if (pathname === '/rolls' || pathname === '/') {
    return [{ label: 'Rolls' }]
  }

  const rollMatch = pathname.match(/^\/rolls\/([^/]+)/)
  if (rollMatch) {
    const roll = rolls.find((r) => r.id === rollMatch[1])
    return [
      { label: 'Rolls', href: '/rolls' },
      { label: roll?.name ?? 'Roll' },
    ]
  }

  if (pathname === '/galleries') {
    return [{ label: 'Galleries' }]
  }

  if (/^\/galleries\/[^/]+/.test(pathname)) {
    return [
      { label: 'Galleries', href: '/galleries' },
      { label: 'Gallery' },
    ]
  }

  return []
}
