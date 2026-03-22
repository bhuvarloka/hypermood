'use server'

import { createClient } from '@/lib/supabase/server'
import { uploadToImageKit } from '@/lib/imagekit/upload'
import { extractExif } from '@/lib/exif/extract'
import { inngest } from '@/lib/inngest/client'
import type { TablesInsert } from '@/lib/supabase/types'

export async function uploadImages(formData: FormData): Promise<{ imageIds: string[] }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const rollId = formData.get('rollId')
  if (typeof rollId !== 'string' || !rollId) throw new Error('rollId is required')

  const files = formData.getAll('files') as File[]
  if (files.length === 0) throw new Error('No files provided')

  const imageIds: string[] = []

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const exif = await extractExif(buffer)
    const storageKey = await uploadToImageKit(buffer, rollId, file.name)

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
      .insert(row as never)
      .select('id')
      .single()

    if (error || !data) throw new Error(`Failed to create image row: ${error?.message}`)
    imageIds.push((data as { id: string }).id)
  }

  await inngest.send({ name: 'indexing/start.roll', data: { rollId } })

  return { imageIds }
}
