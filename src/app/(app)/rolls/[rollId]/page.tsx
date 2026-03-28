import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CommandCenter } from '@/components/roll/command-center'
import type { Image as ImageRecord, Roll } from '@/types/domain'

type Props = {
  params: Promise<{ rollId: string }>
}

export default async function RollDetailPage({ params }: Props) {
  const { rollId } = await params
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) notFound()

  const { data: roll, error: rollError } = await supabase
    .from('rolls')
    .select('*')
    .eq('id', rollId)
    .eq('user_id', user.id)
    .single()

  if (rollError || !roll) notFound()

  const { data: images } = await supabase
    .from('images')
    .select('*')
    .eq('roll_id', rollId)
    .order('uploaded_at', { ascending: false })

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <CommandCenter
        rollId={rollId}
        roll={roll as Roll}
        initialImages={(images ?? []) as ImageRecord[]}
      />
    </div>
  )
}
