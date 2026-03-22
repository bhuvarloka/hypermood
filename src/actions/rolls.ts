'use server'

import { createClient } from '@/lib/supabase/server'
import type { Roll, RollWithImageCount } from '@/types/domain'
import type { TablesInsert } from '@/lib/supabase/types'

export async function createRoll(name: string, description?: string): Promise<Roll> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const row: TablesInsert<'rolls'> = {
    user_id: user.id,
    name,
    description: description ?? null,
  }

  const { data, error } = await supabase
    .from('rolls')
    .insert(row as never)
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create roll: ${error?.message}`)
  return data as Roll
}

// Supabase nested count: images(count) issues a single DB-side aggregate per roll,
// with no per-image row transfer — safe at any image count.
type RollWithNestedCount = Roll & { image_count: [{ count: number }] }

export async function listRolls(): Promise<RollWithImageCount[]> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  // Two queries in parallel:
  // 1. Rolls with total image count via nested aggregate (no row transfer)
  // 2. Indexed image counts grouped by roll_id — fetches only roll_id for indexed images.
  //    This set is typically small relative to total images; full accuracy requires
  //    a DB-side GROUP BY which needs an RPC. This is acceptable for MVP scale.
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
}
