'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { GalleryDrawer } from '@/components/gallery/gallery-drawer'

type Props = {
  params: Promise<{ galleryId: string }>
}

export default function GalleryDetailPage({ params }: Props) {
  const { galleryId } = use(params)
  const router = useRouter()

  return (
    <GalleryDrawer
      initialGalleryId={galleryId}
      onClose={() => router.push('/rolls')}
    />
  )
}
