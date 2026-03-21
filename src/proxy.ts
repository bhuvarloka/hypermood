import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh session — do not add any logic between createServerClient and getUser.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect unauthenticated users away from protected app routes.
  if (!user && isAppRoute(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from the login page.
  if (user && pathname === '/login') {
    const rollsUrl = request.nextUrl.clone()
    rollsUrl.pathname = '/rolls'
    return NextResponse.redirect(rollsUrl)
  }

  return supabaseResponse
}

function isAppRoute(pathname: string): boolean {
  const appPrefixes = ['/rolls', '/galleries', '/upload']
  return appPrefixes.some((prefix) => pathname.startsWith(prefix))
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and Next.js internals.
     * This ensures session is refreshed on every navigation.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
