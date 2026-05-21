'use client'

import { Suspense, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function OtpBoxes({ onComplete, loading, error }: {
  onComplete: (code: string) => void
  loading: boolean
  error: string | null
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)

    if (digit && index < 5) {
      refs.current[index + 1]?.focus()
    }

    if (next.every(Boolean)) {
      onComplete(next.join(''))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ''
        setDigits(next)
      } else if (index > 0) {
        refs.current[index - 1]?.focus()
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return

    const next = Array(6).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)

    const lastFilled = Math.min(pasted.length, 5)
    refs.current[lastFilled]?.focus()

    if (pasted.length === 6) {
      onComplete(pasted)
    }
  }

  return (
    <div className="flex gap-2" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          value={digit}
          maxLength={1}
          autoFocus={i === 0}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          disabled={loading}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`w-12 h-14 text-center text-xl tabular-nums bg-primary-900 border text-white rounded-none focus:outline-none animate-swiss disabled:opacity-40 ${
            error ? 'border-semantic-alert' : 'border-primary-800 focus:border-white'
          }`}
        />
      ))}
    </div>
  )
}

function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
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

  async function handleCodeComplete(code: string) {
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
      setLoading(false)
    } else {
      router.push('/rolls')
    }
  }

  return (
    <>
      <h1 className="text-5xl tracking-tight text-white font-sans mb-12">Hypermood</h1>

      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3 w-full max-w-xs">
          {error && (
            <p className="text-sm text-semantic-alert">{error}</p>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
            autoComplete="email"
            className="bg-transparent border border-primary-800 text-white text-lg px-4 py-3 rounded-none placeholder:text-primary-800 focus:outline-none focus:border-white animate-swiss"
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
        <div className="flex flex-col gap-4 items-start">
          <p className="text-sm text-primary-200">
            Code sent to {email}
          </p>
          <OtpBoxes onComplete={handleCodeComplete} loading={loading} error={error} />
          {error && (
            <p className="text-sm text-semantic-alert">{error}</p>
          )}
          {loading && (
            <p className="text-sm text-primary-200">Verifying…</p>
          )}
          <button
            type="button"
            onClick={() => { setStep('email'); setError(null) }}
            className="text-sm text-primary-400 animate-swiss hover:text-white mt-2"
          >
            Use a different email
          </button>
        </div>
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
