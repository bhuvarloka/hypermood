'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // No emailRedirectTo — sends a 6-digit code instead of a magic link.
    })

    if (error) {
      setError(error.message)
    } else {
      setStep('code')
    }

    setLoading(false)
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })

    if (error) {
      setError(error.message)
    } else {
      router.push('/rolls')
    }

    setLoading(false)
  }

  return (
    <>
      <h1 className="text-5xl tracking-tight text-white font-sans mb-12">Hypermood</h1>

      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3 w-full max-w-xs">
          {error && (
            <p className="text-base font-mono text-semantic-alert">{error}</p>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
            autoComplete="email"
            className="bg-transparent border border-primary-800 text-white text-lg px-4 py-3 rounded-none placeholder:text-primary-800 focus:outline-none focus:ring-2 focus:ring-white animate-swiss"
          />
          <button
            type="submit"
            disabled={loading}
            className="text-base font-medium text-primary-950 bg-white px-4 py-3 rounded-none animate-swiss hover:opacity-90 disabled:opacity-40"
          >
            {loading ? 'Sending…' : 'Continue'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCodeSubmit} className="flex flex-col gap-3 w-full max-w-xs">
          <p className="text-base font-mono text-primary-200 mb-1">
            Code sent to {email}
          </p>
          {error && (
            <p className="text-base font-mono text-semantic-alert">{error}</p>
          )}
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            placeholder="000000"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            className="bg-transparent border border-primary-800 text-white text-lg px-4 py-3 rounded-none placeholder:text-primary-800 focus:outline-none focus:ring-2 focus:ring-white animate-swiss tracking-widest"
          />
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="text-base font-medium text-primary-950 bg-white px-4 py-3 rounded-none animate-swiss hover:opacity-90 disabled:opacity-40"
          >
            {loading ? 'Verifying…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('email'); setCode(''); setError(null) }}
            className="text-base font-mono text-primary-200 animate-swiss hover:text-white"
          >
            Use a different email
          </button>
        </form>
      )}
    </>
  )
}

export default function LoginPage() {
  return (
    <main className="h-screen bg-primary-950 flex flex-col items-center justify-center px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  )
}
