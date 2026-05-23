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

type AuthParams = {
  token: string
  signature: string
  expire: number
  publicKey: string
}

type ImageKitUploadResponse = {
  filePath: string
  width?: number
  height?: number
  name: string
}

async function fetchAuthParams(): Promise<AuthParams> {
  const res = await fetch('/api/images/upload-auth')
  if (!res.ok) throw new Error('Failed to get upload auth')
  return res.json() as Promise<AuthParams>
}

async function uploadFileToImageKit(
  file: File,
  rollId: string,
  auth: AuthParams,
): Promise<ImageKitUploadResponse> {
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.\-]/g, '_')

  const form = new FormData()
  form.append('file', file)
  form.append('fileName', sanitizedFilename)
  form.append('folder', `hypermood/rolls/${rollId}`)
  form.append('publicKey', auth.publicKey)
  form.append('token', auth.token)
  form.append('signature', auth.signature)
  form.append('expire', String(auth.expire))
  form.append('useUniqueFileName', 'false')

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ImageKit upload failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<ImageKitUploadResponse>
}

export function AmbientUpload({ rollId, children }: Props) {
  const [state, setState] = useState<UploadState>({ phase: 'idle' })
  // Track drag entries to handle nested child elements correctly
  const dragCountRef = useRef(0)

  // Reset on window dragend — covers Escape / drop outside browser window
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

      try {
        // One auth token covers all files in a single drop (same expiry window)
        const auth = await fetchAuthParams()

        let done = 0
        const registered: {
          storagePath: string
          originalFilename: string
          fileSizeBytes: number
          mimeType: string
          width: number | null
          height: number | null
          capturedAt: string | null
        }[] = []

        // Upload files concurrently; update progress as each one completes
        await Promise.all(
          files.map(async (file) => {
            const result = await uploadFileToImageKit(file, rollId, auth)
            registered.push({
              storagePath: result.filePath,
              originalFilename: file.name,
              fileSizeBytes: file.size,
              mimeType: file.type,
              width: result.width ?? null,
              height: result.height ?? null,
              capturedAt: null,
            })
            done += 1
            setState({ phase: 'uploading', done, total: files.length })
          }),
        )

        // Single register call after all uploads complete
        const res = await fetch('/api/images/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rollId, files: registered }),
        })
        if (!res.ok) throw new Error(await res.text())
      } finally {
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

      {/* Inline progress readout — unobtrusive, updates in place */}
      {isUploading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <p className="text-sm tabular-nums text-primary-400">
            Uploading {state.done} of {state.total}…
          </p>
        </div>
      )}
    </div>
  )
}
