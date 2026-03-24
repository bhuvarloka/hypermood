import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type RollThumbnailMap = Record<string, string[]>

// Fetches up to 4 storage_keys per roll for the Rail micro-preview grid.
// Uses a window function via RPC so the 4-per-roll cap is enforced in Postgres,
// not by a global LIMIT that would starve later rolls of results.
// Wrapped in React cache() so layout + page calls within one request share one DB round-trip.
export const getRollThumbnails = cache(async function getRollThumbnails(rollIds: string[]): Promise<RollThumbnailMap> {
  if (rollIds.length === 0) return {}

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_roll_thumbnails', {
    p_roll_ids: rollIds,
    p_limit: 4,
  })

  if (error || !data) return {}

  const map: RollThumbnailMap = {}
  for (const row of data as { roll_id: string; storage_key: string }[]) {
    const bucket = (map[row.roll_id] ??= [])
    bucket.push(row.storage_key)
  }
  return map
})
