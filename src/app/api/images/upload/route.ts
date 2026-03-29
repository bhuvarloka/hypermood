import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadToImageKit } from '@/lib/imagekit/upload'
import { extractExif } from '@/lib/exif/extract'
import { inngest } from '@/lib/inngest/client'
import type { Image } from '@/types/domain'
import type { TablesInsert } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()

  const rollId = formData.get('rollId')
  if (typeof rollId !== 'string' || !rollId) {
    return NextResponse.json({ error: 'rollId is required' }, { status: 400 })
  }

  // Verify the caller owns this roll before touching storage or the DB
  const { data: roll, error: rollError } = await supabase
    .from('rolls')
    .select('id')
    .eq('id', rollId)
    .eq('user_id', user.id)
    .single()
  if (rollError || !roll) {
    return NextResponse.json({ error: 'Roll not found or access denied' }, { status: 403 })
  }

  const files = formData.getAll('files') as File[]
  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

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

  return NextResponse.json({ imageIds })
}
