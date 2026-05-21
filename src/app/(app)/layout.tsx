import { unauthorized } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listRollsCached } from '@/lib/rolls/list'
import { getRollThumbnails } from '@/lib/rolls/thumbnails'
import { TopBar } from '@/components/shell/top-bar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return unauthorized()

  const rolls = await listRollsCached()
  const rollThumbnails = await getRollThumbnails(rolls.map((r) => r.id))

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      <TopBar
        rolls={rolls}
        rollThumbnails={rollThumbnails}
        userEmail={user.email ?? ''}
      />
      <main className="flex-1 overflow-hidden bg-white flex flex-col min-h-0">
        {children}
      </main>
    </div>
  )
}
