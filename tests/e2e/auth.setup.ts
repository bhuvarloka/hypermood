import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup('authenticate as test user', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!email) throw new Error('TEST_USER_EMAIL must be set in .env.test.local')
  if (!url || !anonKey || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY must be set',
    )
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError || !linkData?.properties?.email_otp) {
    throw new Error(`Failed to generate OTP: ${linkError?.message ?? 'no email_otp'}`)
  }

  type Cookie = { name: string; value: string; options?: CookieOptions }
  const cookieJar: Cookie[] = []

  const ssr = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieJar.map(({ name, value }) => ({ name, value }))
      },
      setAll(toSet) {
        for (const { name, value, options } of toSet) {
          const existing = cookieJar.findIndex((c) => c.name === name)
          if (existing >= 0) cookieJar.splice(existing, 1)
          cookieJar.push({ name, value, options })
        }
      },
    },
  })

  const { error: verifyError } = await ssr.auth.verifyOtp({
    type: 'email',
    email,
    token: linkData.properties.email_otp,
  })
  if (verifyError) throw new Error(`verifyOtp failed: ${verifyError.message}`)

  await page.context().addCookies(
    cookieJar.map(({ name, value }) => ({
      name,
      value,
      url: 'http://localhost:3000',
    })),
  )

  await page.goto('/rolls')
  await page.waitForURL(/\/rolls/, { timeout: 15000 })

  await page.context().storageState({ path: AUTH_FILE })
})
