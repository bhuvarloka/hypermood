import { Suspense } from 'react'
import { unauthorized } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBarData } from '@/components/shell/top-bar-data'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return unauthorized()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      <Suspense fallback={<div className="h-14 shrink-0 border-b border-primary-100 bg-white" />}>
        <TopBarData userEmail={user.email ?? ''} />
      </Suspense>
      <main className="flex-1 overflow-hidden bg-white flex flex-col min-h-0">
        <Suspense>
          {children}
        </Suspense>
      </main>
    </div>
  )
}
