import { unauthorized } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listRollsCached } from '@/lib/rolls/list'
import { getRollThumbnails } from '@/lib/rolls/thumbnails'
import { Rail } from '@/components/roll/rail'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return unauthorized()

  const rolls = await listRollsCached()
  const rollIds = rolls.map((r) => r.id)
  const thumbnails = await getRollThumbnails(rollIds)

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Rail
        rolls={rolls}
        thumbnails={thumbnails}
        userEmail={user.email ?? ''}
      />
      <main className="flex-1 overflow-hidden bg-white flex flex-col">
        {children}
      </main>
    </div>
  )
}
