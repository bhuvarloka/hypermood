import { notFound } from 'next/navigation'
import { getPublicGallery } from '@/actions/galleries'
import { PublicGalleryView } from '@/components/gallery/public-gallery-view'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function PublicGalleryPage({ params }: Props) {
  const { slug } = await params

  let gallery
  try {
    gallery = await getPublicGallery(slug)
  } catch {
    notFound()
  }

  return <PublicGalleryView gallery={gallery} />
}
