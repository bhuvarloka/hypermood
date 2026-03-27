'use server'

import { createClient } from '@/lib/supabase/server'
import { createAnonClient } from '@/lib/supabase/admin'
import type { Gallery, GalleryLayout, GalleryWithImages, GalleryListItem, Image } from '@/types/domain'
import type { Json, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}

async function resolveUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  base: string,
  excludeGalleryId?: string,
): Promise<string> {
  let query = supabase
    .from('galleries')
    .select('slug')
    .eq('user_id', userId)
    .like('slug', `${base}%`)

  // Exclude the current gallery's own slug so renames to the same name don't
  // generate a spurious suffix (which would break existing public URLs).
  if (excludeGalleryId) {
    query = query.neq('id', excludeGalleryId)
  }

  const { data } = await query as { data: { slug: string }[] | null }

  const existing = new Set((data ?? []).map((r) => r.slug))
  if (!existing.has(base)) return base

  // Append random suffix until unique — collision probability is negligible at MVP scale.
  let candidate: string
  do {
    candidate = `${base}-${randomSuffix()}`
  } while (existing.has(candidate))

  return candidate
}

// Shared ownership guard for gallery_images mutations. Verifies the gallery
// belongs to the authenticated user before any write, providing defense-in-depth
// beyond the RLS policies on gallery_images.
async function assertGalleryOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  galleryId: string,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from('galleries')
    .select('id')
    .eq('id', galleryId)
    .eq('user_id', userId)
    .single()

  if (!data) throw new Error('Gallery not found or access denied')
}

export async function createGallery(
  rollId: string,
  name: string,
  imageIds: string[],
  filterCriteria?: Json,
  layout?: GalleryLayout,
  isPublic?: boolean,
): Promise<Gallery> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const baseSlug = toSlug(name) || randomSuffix()
  const slug = await resolveUniqueSlug(supabase, user.id, baseSlug)

  const galleryRow: TablesInsert<'galleries'> = {
    user_id: user.id,
    roll_id: rollId,
    name,
    slug,
    is_public: isPublic ?? false,
    layout: layout ?? 'masonry',
    filter_criteria: filterCriteria ?? null,
  }

  const { data: galleryData, error: galleryError } = await supabase
    .from('galleries')
    .insert(galleryRow as never)
    .select()
    .single()

  if (galleryError || !galleryData) throw new Error(`Failed to create gallery: ${galleryError?.message}`)

  const gallery = galleryData as Gallery

  if (imageIds.length > 0) {
    const imageRows: TablesInsert<'gallery_images'>[] = imageIds.map((imageId, i) => ({
      gallery_id: gallery.id,
      image_id: imageId,
      position: i,
    }))

    const { error: imagesError } = await supabase
      .from('gallery_images')
      .insert(imageRows as never)

    if (imagesError) {
      // Roll back the gallery row so we don't leave an orphan.
      await supabase.from('galleries').delete().eq('id', gallery.id)
      throw new Error(`Failed to add images to gallery: ${imagesError.message}`)
    }
  }

  return gallery
}

export async function updateGallery(
  galleryId: string,
  updates: { name?: string; layout?: GalleryLayout; is_public?: boolean; description?: string },
): Promise<Gallery> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const patch: TablesUpdate<'galleries'> = { ...updates }

  if (updates.name !== undefined) {
    const baseSlug = toSlug(updates.name) || randomSuffix()
    // Exclude this gallery's own slug from the collision check so renaming to
    // the same name preserves the existing slug rather than appending a suffix.
    patch.slug = await resolveUniqueSlug(supabase, user.id, baseSlug, galleryId)
  }

  const { data, error } = await supabase
    .from('galleries')
    .update(patch as never)
    .eq('id', galleryId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to update gallery: ${error?.message}`)
  return data as Gallery
}

export async function addImagesToGallery(galleryId: string, imageIds: string[]): Promise<void> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  await assertGalleryOwner(supabase, galleryId, user.id)

  // Find the current max position to append after existing images.
  const { data: existing } = await supabase
    .from('gallery_images')
    .select('position')
    .eq('gallery_id', galleryId)
    .order('position', { ascending: false })
    .limit(1) as { data: { position: number }[] | null }

  const startPosition = (existing?.[0]?.position ?? -1) + 1

  const rows: TablesInsert<'gallery_images'>[] = imageIds.map((imageId, i) => ({
    gallery_id: galleryId,
    image_id: imageId,
    position: startPosition + i,
  }))

  const { error } = await supabase
    .from('gallery_images')
    .insert(rows as never)

  if (error) throw new Error(`Failed to add images: ${error.message}`)
}

export async function removeImagesFromGallery(galleryId: string, imageIds: string[]): Promise<void> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  await assertGalleryOwner(supabase, galleryId, user.id)

  const { error } = await supabase
    .from('gallery_images')
    .delete()
    .eq('gallery_id', galleryId)
    .in('image_id', imageIds)

  if (error) throw new Error(`Failed to remove images: ${error.message}`)
}

export async function reorderGalleryImages(galleryId: string, orderedImageIds: string[]): Promise<void> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  await assertGalleryOwner(supabase, galleryId, user.id)

  // Upsert each image's position based on its index in the ordered list.
  const { data: existing } = await supabase
    .from('gallery_images')
    .select('id, image_id')
    .eq('gallery_id', galleryId) as { data: { id: string; image_id: string }[] | null }

  const idByImageId = new Map((existing ?? []).map((r) => [r.image_id, r.id]))

  const updates = orderedImageIds
    .map((imageId, i) => {
      const id = idByImageId.get(imageId)
      if (!id) return null
      return { id, gallery_id: galleryId, image_id: imageId, position: i }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (updates.length === 0) return

  const { error } = await supabase
    .from('gallery_images')
    .upsert(updates as never)

  if (error) throw new Error(`Failed to reorder images: ${error.message}`)
}

export async function listGalleries(rollId?: string): Promise<Gallery[]> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  let query = supabase
    .from('galleries')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (rollId) {
    query = query.eq('roll_id', rollId)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to list galleries: ${error.message}`)
  return (data ?? []) as Gallery[]
}

export async function getGalleryImages(galleryId: string): Promise<Image[]> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  await assertGalleryOwner(supabase, galleryId, user.id)

  const { data, error } = await supabase
    .from('gallery_images')
    .select('position, images(*)')
    .eq('gallery_id', galleryId)
    .order('position', { ascending: true }) as {
      data: { position: number; images: Record<string, unknown> | null }[] | null
      error: { message: string } | null
    }

  if (error) throw new Error(`Failed to fetch gallery images: ${error.message}`)

  return (data ?? [])
    .map((r) => r.images)
    .filter((img): img is Record<string, unknown> => img !== null) as unknown as Image[]
}

// Public image fields safe to expose to unauthenticated viewers.
const PUBLIC_IMAGE_FIELDS = 'id, storage_key, original_filename, width, height, mime_type, captured_at' as const

export async function getPublicGallery(slug: string): Promise<GalleryWithImages> {
  const supabase = createAnonClient()

  // Single join query: gallery → gallery_images → images (ordered by position).
  // Avoids three sequential round-trips and the manual sort below.
  type NestedImage = { position: number; images: Record<string, unknown> | null }
  type GalleryWithNested = Record<string, unknown> & { gallery_images: NestedImage[] }
  type QueryResult = { data: GalleryWithNested | null; error: { message: string } | null }

  const { data, error } = (await supabase
    .from('galleries')
    .select(`*, gallery_images(position, images(${PUBLIC_IMAGE_FIELDS}))`)
    .eq('slug', slug)
    .eq('is_public', true)
    .order('position', { referencedTable: 'gallery_images', ascending: true })
    .single()) as QueryResult

  if (error || !data) throw new Error('Gallery not found')

  const { gallery_images, ...galleryFields } = data
  const images = gallery_images
    .map((r) => r.images)
    .filter((img): img is Record<string, unknown> => img !== null) as unknown as Image[]

  return { ...(galleryFields as Gallery), images }
}

const GALLERY_THUMBNAIL_LIMIT = 4

export async function listGalleriesWithImageData(rollId?: string): Promise<GalleryListItem[]> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  let query = supabase
    .from('galleries')
    .select(`*, gallery_images(position, images(id, storage_key))`)
    .eq('user_id', user.id)
    .order('position', { referencedTable: 'gallery_images', ascending: true })
    .order('created_at', { ascending: false })

  if (rollId) query = query.eq('roll_id', rollId)

  type NestedGallery = Record<string, unknown> & {
    gallery_images: { images: { id: string; storage_key: string } | null }[]
  }

  const { data, error } = await query as { data: NestedGallery[] | null; error: { message: string } | null }
  if (error) throw new Error(`Failed to list galleries: ${error.message}`)

  return (data ?? []).map((row) => {
    const { gallery_images, ...galleryFields } = row
    const thumbnail_keys = gallery_images
      .slice(0, GALLERY_THUMBNAIL_LIMIT)
      .map((gi) => gi.images?.storage_key)
      .filter((k): k is string => !!k)
    return { ...(galleryFields as Gallery), image_count: gallery_images.length, thumbnail_keys }
  })
}
