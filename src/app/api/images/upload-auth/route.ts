import { NextResponse } from 'next/server'
import { getUploadAuthParams } from '@imagekit/next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY

  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: 'ImageKit not configured' }, { status: 500 })
  }

  const { token, signature, expire } = getUploadAuthParams({ publicKey, privateKey })

  return NextResponse.json({ token, signature, expire, publicKey })
}
