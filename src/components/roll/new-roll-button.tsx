'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createRoll } from '@/actions/rolls'

export function NewRollButton() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const nameRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (open) nameRef.current?.focus()
  }, [open])

  function handleOpen() {
    setOpen(true)
    setError(null)
  }

  function handleCancel() {
    setOpen(false)
    setError(null)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim()
    const description = (form.elements.namedItem('description') as HTMLInputElement).value.trim()

    if (!name) {
      setError('Name is required.')
      return
    }

    startTransition(async () => {
      try {
        await createRoll(name, description || undefined)
        setOpen(false)
        router.refresh()
      } catch {
        setError('Failed to create roll. Please try again.')
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="text-base font-medium border border-primary-200 px-4 py-2 rounded-none animate-swiss hover:bg-primary-100"
      >
        New Roll
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-bloom flex items-start gap-3"
    >
      <div className="flex flex-col gap-1">
        <input
          ref={nameRef}
          name="name"
          type="text"
          placeholder="Roll name"
          autoComplete="off"
          className="text-base border border-primary-200 px-3 py-2 w-52 rounded-none focus:outline-none focus:ring-2 focus:ring-primary-900"
        />
        <input
          name="description"
          type="text"
          placeholder="Description (optional)"
          autoComplete="off"
          className="text-base border border-primary-200 px-3 py-2 w-52 rounded-none focus:outline-none focus:ring-2 focus:ring-primary-900"
        />
        {error && <p className="text-sm text-semantic-alert">{error}</p>}
      </div>

      <div className="flex gap-2 pt-0.5">
        <button
          type="submit"
          disabled={isPending}
          className="text-base font-medium bg-primary-900 text-white px-4 py-2 rounded-none animate-swiss hover:opacity-80 disabled:opacity-40"
        >
          {isPending ? 'Creating…' : 'Create'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="text-base border border-primary-200 px-4 py-2 rounded-none animate-swiss hover:bg-primary-100"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
