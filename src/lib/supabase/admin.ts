import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Service role client: bypasses RLS. Only use in server-side code (Inngest jobs, Server Actions).
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
