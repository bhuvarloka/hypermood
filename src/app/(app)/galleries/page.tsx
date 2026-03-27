'use client'

import { useRouter } from 'next/navigation'
import { GalleryDrawer } from '@/components/gallery/gallery-drawer'

export default function GalleriesPage() {
  const router = useRouter()

  return (
    <GalleryDrawer onClose={() => router.push('/rolls')} />
  )
}
