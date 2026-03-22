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

export async function listRolls(): Promise<RollWithImageCount[]> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('images')
    .select('roll_id, status')
    .eq('user_id', user.id)

  if (error) throw new Error(`Failed to fetch images: ${error.message}`)

  const counts = new Map<string, { total: number; indexed: number }>()
  for (const img of (data ?? []) as { roll_id: string; status: string }[]) {
    const entry = counts.get(img.roll_id) ?? { total: 0, indexed: 0 }
    entry.total++
    if (img.status === 'indexed') entry.indexed++
    counts.set(img.roll_id, entry)
  }

  const { data: rolls, error: rollsError } = await supabase
    .from('rolls')
    .select()
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (rollsError) throw new Error(`Failed to fetch rolls: ${rollsError.message}`)

  return (rolls as Roll[]).map((roll) => {
    const c = counts.get(roll.id) ?? { total: 0, indexed: 0 }
    return { ...roll, image_count: c.total, indexed_count: c.indexed }
  })
}
