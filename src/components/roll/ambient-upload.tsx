'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  rollId: string
  children: React.ReactNode
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'dragging' }
  | { phase: 'uploading'; done: number; total: number }

export function AmbientUpload({ rollId, children }: Props) {
  const [state, setState] = useState<UploadState>({ phase: 'idle' })
  // Track drag entries to handle nested child elements correctly
  const dragCountRef = useRef(0)

  // Reset on window dragend — covers Escape / drop outside browser window
  // where the container never receives a dragleave to decrement the counter
  useEffect(() => {
    const reset = () => {
      dragCountRef.current = 0
      setState((prev) => (prev.phase === 'dragging' ? { phase: 'idle' } : prev))
    }
    window.addEventListener('dragend', reset)
    return () => window.removeEventListener('dragend', reset)
  }, [])

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current += 1
    if (dragCountRef.current === 1) setState({ phase: 'dragging' })
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current -= 1
    if (dragCountRef.current === 0) setState({ phase: 'idle' })
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      dragCountRef.current = 0

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      )
      if (files.length === 0) {
        setState({ phase: 'idle' })
        return
      }

      setState({ phase: 'uploading', done: 0, total: files.length })

      // Upload in batches of 5 to avoid overwhelming the server action
      const BATCH = 5
      let done = 0
      try {
        for (let i = 0; i < files.length; i += BATCH) {
          const batch = files.slice(i, i + BATCH)
          const fd = new FormData()
          fd.append('rollId', rollId)
          batch.forEach((f) => fd.append('files', f))
          const res = await fetch('/api/images/upload', { method: 'POST', body: fd })
          if (!res.ok) throw new Error(await res.text())
          done += batch.length
          setState({ phase: 'uploading', done, total: files.length })
        }
      } finally {
        // Always return to idle — whether upload succeeded or failed
        setState({ phase: 'idle' })
      }
    },
    [rollId],
  )

  const isDragging = state.phase === 'dragging'
  const isUploading = state.phase === 'uploading'

  return (
    <div
      className="relative flex-1 flex flex-col min-h-0"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}

      {/* Drag overlay — stable DOM node, opacity-toggled, never added/removed */}
      <div
        className={[
          'absolute inset-0 bg-white/80 flex items-center justify-center z-50 pointer-events-none',
          isDragging ? 'opacity-100 animate-bloom' : 'opacity-0',
        ].join(' ')}
        aria-hidden={!isDragging}
      >
        <p className="text-3xl font-medium">Drop to index.</p>
      </div>

      {/* Inline progress readout — unobtrusive, mono, updates in place */}
      {isUploading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <p className="text-base font-mono">
            Uploading &amp; Indexing {state.done} of {state.total}...
          </p>
        </div>
      )}
    </div>
  )
}
