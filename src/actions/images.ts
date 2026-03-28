'use server'

import { createClient } from '@/lib/supabase/server'
import { uploadToImageKit, deleteFromImageKit } from '@/lib/imagekit/upload'
import { extractExif } from '@/lib/exif/extract'
import { inngest } from '@/lib/inngest/client'
import type { Image, BaseLayerMetadata } from '@/types/domain'
import type { TablesInsert } from '@/lib/supabase/types'

export async function uploadImages(formData: FormData): Promise<{ imageIds: string[] }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const rollId = formData.get('rollId')
  if (typeof rollId !== 'string' || !rollId) throw new Error('rollId is required')

  // Verify the caller owns this roll before touching storage or the DB
  const { data: roll, error: rollError } = await supabase
    .from('rolls')
    .select('id')
    .eq('id', rollId)
    .eq('user_id', user.id)
    .single()
  if (rollError || !roll) throw new Error('Roll not found or access denied')

  const files = formData.getAll('files') as File[]
  if (files.length === 0) throw new Error('No files provided')

  // Process all files concurrently — consistent with the fan-out philosophy in index-roll.ts
  const imageIds = await Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer())
      const [exif, storageKey] = await Promise.all([
        extractExif(buffer),
        uploadToImageKit(buffer, rollId, file.name),
      ])

      const row: TablesInsert<'images'> = {
        roll_id: rollId,
        user_id: user.id,
        storage_key: storageKey,
        original_filename: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        width: exif.width,
        height: exif.height,
        captured_at: exif.capturedAt?.toISOString() ?? null,
        status: 'pending',
      }

      const { data, error } = await supabase
        .from('images')
        .upsert(row as never, { onConflict: 'storage_key', ignoreDuplicates: true })
        .select('id')
        .maybeSingle()

      if (error) throw new Error(`Failed to create image row for ${file.name}: ${error.message}`)

      // ignoreDuplicates returns null when skipped — fetch the existing row
      if (!data) {
        const { data: existing, error: fetchError } = await supabase
          .from('images')
          .select('id')
          .eq('storage_key', row.storage_key)
          .single()
        if (fetchError || !existing) throw new Error(`Failed to find existing image row for ${file.name}`)
        return (existing as Image).id
      }

      return (data as Image).id
    }),
  )

  await inngest.send({ name: 'indexing/start.roll', data: { rollId } })

  return { imageIds }
}

export async function getImageMetadata(imageId: string): Promise<BaseLayerMetadata | null> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('image_metadata')
    .select('metadata')
    .eq('image_id', imageId)
    .eq('user_id', user.id)
    .single()

  if (error || !data?.metadata) return null
  return data.metadata as unknown as BaseLayerMetadata
}

export async function deleteImages(imageIds: string[]): Promise<void> {
  if (imageIds.length === 0) return

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  // Fetch storage keys — RLS ensures only owned images are returned
  const { data: images, error: fetchError } = await supabase
    .from('images')
    .select('id, storage_key')
    .in('id', imageIds)
    .eq('user_id', user.id)

  if (fetchError) throw new Error(`Failed to fetch images: ${fetchError.message}`)
  if (!images || images.length === 0) return

  const ownedIds = (images as Pick<Image, 'id' | 'storage_key'>[]).map((img) => img.id)
  const storageKeys = (images as Pick<Image, 'id' | 'storage_key'>[]).map((img) => img.storage_key)

  const { error: deleteError } = await supabase
    .from('images')
    .delete()
    .in('id', ownedIds)

  if (deleteError) throw new Error(`Failed to delete images: ${deleteError.message}`)

  // Best-effort: ImageKit cleanup after DB delete succeeds
  await deleteFromImageKit(storageKeys)
}
