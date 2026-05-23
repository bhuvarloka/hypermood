import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import type { Image } from '@/types/domain'
import type { TablesInsert } from '@/lib/supabase/types'

type RegisterBody = {
  rollId: string
  files: {
    storagePath: string
    originalFilename: string
    fileSizeBytes: number
    mimeType: string
    width: number | null
    height: number | null
    capturedAt: string | null
  }[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: RegisterBody = await req.json()
  const { rollId, files } = body

  if (!rollId || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'rollId and files are required' }, { status: 400 })
  }

  const { data: roll, error: rollError } = await supabase
    .from('rolls')
    .select('id')
    .eq('id', rollId)
    .eq('user_id', user.id)
    .single()
  if (rollError || !roll) return NextResponse.json({ error: 'Roll not found or access denied' }, { status: 403 })

  const imageIds = await Promise.all(
    files.map(async (file) => {
      const row: TablesInsert<'images'> = {
        roll_id: rollId,
        user_id: user.id,
        storage_key: file.storagePath,
        original_filename: file.originalFilename,
        file_size_bytes: file.fileSizeBytes,
        mime_type: file.mimeType,
        width: file.width,
        height: file.height,
        captured_at: file.capturedAt,
        status: 'pending',
      }

      const { data, error } = await supabase
        .from('images')
        .upsert(row as never, { onConflict: 'storage_key', ignoreDuplicates: true })
        .select('id')
        .maybeSingle()

      if (error) throw new Error(`Failed to register ${file.originalFilename}: ${error.message}`)

      if (!data) {
        const { data: existing, error: fetchError } = await supabase
          .from('images')
          .select('id')
          .eq('storage_key', file.storagePath)
          .single()
        if (fetchError || !existing) throw new Error(`Failed to find existing row for ${file.originalFilename}`)
        return (existing as Image).id
      }

      return (data as Image).id
    }),
  )

  await inngest.send({ name: 'indexing/start.roll', data: { rollId } })

  return NextResponse.json({ imageIds })
}
