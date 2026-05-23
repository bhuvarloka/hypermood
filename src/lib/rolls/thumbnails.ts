import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type RollThumbnailMap = Record<string, string[]>

// React cache() deduplicates calls across layout + page within the same request
export const getRollThumbnails = cache(async function getRollThumbnails(rollIds: string[]): Promise<RollThumbnailMap> {
  if (rollIds.length === 0) return {}

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_roll_thumbnails', {
    p_roll_ids: rollIds,
    p_limit: 5,
  } as never)

  if (error || !data) return {}

  const map: RollThumbnailMap = {}
  for (const row of data as { roll_id: string; storage_key: string }[]) {
    const bucket = (map[row.roll_id] ??= [])
    bucket.push(row.storage_key)
  }
  return map
})
