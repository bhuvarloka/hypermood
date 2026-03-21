import { unauthorized } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Proxy handles the redirect for optimistic checks, but we verify the session
// here via unauthorized() so RSC children can trust that a user exists.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    unauthorized()
  }

  return <>{children}</>
}
