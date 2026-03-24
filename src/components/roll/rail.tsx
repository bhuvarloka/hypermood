'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'
import { getImageUrl } from '@/lib/imagekit/url'
import type { RollWithImageCount } from '@/types/domain'
import type { RollThumbnailMap } from '@/lib/rolls/thumbnails'

type Props = {
  rolls: RollWithImageCount[]
  thumbnails: RollThumbnailMap
  userEmail: string
}

export function Rail({ rolls, thumbnails, userEmail }: Props) {
  return (
    <nav className="flex flex-col h-full w-56 shrink-0">
      <div className="flex-1 overflow-y-auto py-8 px-5">
        <Link
          href="/rolls"
          className="block text-base font-medium text-primary-900 mb-8 animate-swiss hover:text-primary-800"
        >
          Hypermood
        </Link>

        <ul className="space-y-1">
          {rolls.map((roll) => (
            <RailRollItem
              key={roll.id}
              roll={roll}
              storageKeys={thumbnails[roll.id] ?? []}
            />
          ))}
          {rolls.length === 0 && (
            <li className="text-lg text-primary-900">No rolls yet</li>
          )}
        </ul>
      </div>

      <div className="px-5 py-6">
        <RailUser email={userEmail} />
      </div>
    </nav>
  )
}

function RailRollItem({
  roll,
  storageKeys,
}: {
  roll: RollWithImageCount
  storageKeys: string[]
}) {
  const pathname = usePathname()
  const isActive = pathname.startsWith(`/rolls/${roll.id}`)
  const [showPreview, setShowPreview] = useState(false)

  return (
    // Wrapper covers both the link and the absolutely-positioned popup,
    // so mouse-leave only fires when leaving the combined hover zone.
    <li
      className="relative"
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
    >
      <Link
        href={`/rolls/${roll.id}`}
        className={`block text-lg text-primary-900 py-1 -mx-2 px-2 animate-swiss hover:bg-primary-100 truncate ${
          isActive ? 'font-medium' : ''
        }`}
      >
        {roll.name}
      </Link>

      {showPreview && storageKeys.length > 0 && (
        // Extend hover zone rightward to cover the popup via padding,
        // so moving into the popup doesn't trigger onMouseLeave on the <li>.
        <div className="absolute left-full top-0 pl-2 z-50">
          <RollMicroPreview storageKeys={storageKeys} />
        </div>
      )}
    </li>
  )
}

function RollMicroPreview({ storageKeys }: { storageKeys: string[] }) {
  const slots = Array.from({ length: 4 }, (_, i) => storageKeys[i] ?? null)

  return (
    <div className="animate-bloom p-1 bg-white">
      <div className="grid grid-cols-2 gap-px w-20 h-20">
        {slots.map((key, i) =>
          key ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={getImageUrl(key, { width: 40, height: 40, quality: 60 })}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div key={i} className="bg-primary-100" />
          ),
        )}
      </div>
    </div>
  )
}

function RailUser({ email }: { email: string }) {
  const initial = email[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 bg-primary-900 text-white flex items-center justify-center text-base font-medium shrink-0 select-none">
        {initial}
      </div>
      <span className="text-base font-mono truncate flex-1 min-w-0">{email}</span>
      <form action={signOut}>
        <button
          type="submit"
          className="text-primary-200 animate-swiss hover:text-primary-900 shrink-0"
          aria-label="Sign out"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </form>
    </div>
  )
}
