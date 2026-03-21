'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const centerLayout: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '1rem',
}

export default function LoginPage() {
  const searchParams = useSearchParams()
  const callbackError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // After clicking the magic link, redirect to the auth callback handler.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSubmitted(true)
    }

    setLoading(false)
  }

  if (submitted) {
    return (
      <main style={centerLayout}>
        <h1>Check your email</h1>
        <p>We sent a magic link to <strong>{email}</strong>. Click it to sign in.</p>
      </main>
    )
  }

  return (
    <main style={centerLayout}>
      <h1>Sign in to Hypermood</h1>
      {callbackError === 'auth_callback_failed' && (
        <p style={{ color: 'red' }}>Your sign-in link was invalid or expired. Please try again.</p>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '360px' }}>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          style={{ padding: '0.5rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '0.5rem 1rem', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Sending…' : 'Send magic link'}
        </button>
      </form>
    </main>
  )
}
