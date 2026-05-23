import { createClient } from '@/lib/supabase/server'
import { listRollsCached } from '@/lib/rolls/list'
import { getRollThumbnails } from '@/lib/rolls/thumbnails'
import { TopBar } from './top-bar'

export async function TopBarData({ userEmail }: { userEmail: string }) {
  const rolls = await listRollsCached()
  const rollThumbnails = await getRollThumbnails(rolls.map((r) => r.id))

  return <TopBar rolls={rolls} rollThumbnails={rollThumbnails} userEmail={userEmail} />
}
