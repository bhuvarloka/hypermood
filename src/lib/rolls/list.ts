import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Roll, RollWithImageCount } from '@/types/domain'

type RollWithNestedCount = Roll & { image_count: [{ count: number }] }

// Cached per-request so layout + page don't each issue separate DB queries.
export const listRollsCached = cache(async function listRollsCached(): Promise<RollWithImageCount[]> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const [rollsResult, indexedResult] = await Promise.all([
    supabase
      .from('rolls')
      .select('*, image_count:images(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('images')
      .select('roll_id')
      .eq('user_id', user.id)
      .eq('status', 'indexed')
      .limit(10000),
  ])

  if (rollsResult.error) throw new Error(`Failed to fetch rolls: ${rollsResult.error.message}`)
  if (indexedResult.error) throw new Error(`Failed to fetch indexed counts: ${indexedResult.error.message}`)

  const indexedByRoll = new Map<string, number>()
  for (const row of (indexedResult.data ?? []) as { roll_id: string }[]) {
    indexedByRoll.set(row.roll_id, (indexedByRoll.get(row.roll_id) ?? 0) + 1)
  }

  return (rollsResult.data as unknown as RollWithNestedCount[]).map(({ image_count, ...roll }) => ({
    ...roll,
    image_count: image_count[0]?.count ?? 0,
    indexed_count: indexedByRoll.get(roll.id) ?? 0,
  }))
})
