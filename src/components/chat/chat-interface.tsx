'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { sendMessage, getChatHistory, rerunWithModifiedFilters } from '@/actions/chat'
import { FilterChips } from '@/components/chat/filter-chips'
import type { FilterMod } from '@/actions/chat'
import type { QueryPlan } from '@/lib/gemini/query'
import { RollImageGrid } from '@/components/roll/roll-image-grid'
import { Darkroom } from '@/components/roll/darkroom'
import { PreviewPanel } from '@/components/chat/preview-panel'
import { ProcessingIndicator } from '@/components/chat/processing-indicator'
import { getImageUrl } from '@/lib/imagekit/url'
import type { ChatMessageWithResults, Image as ImageRecord } from '@/types/domain'

const GALLERY_INTENT_RE = /\b(show|open|view|see|list)\b.*\bgalleries?\b/i

const UNIVERSAL_SUGGESTIONS = [
  'Show me the best shots',
  'Find all portraits',
  "What's in this roll?",
]

type MessageWithFollowups = ChatMessageWithResults & {
  followups?: string[]
  // Populated only for synthetic gallery-saved confirmation messages; never persisted to DB
  galleryLink?: string
}

type Props = {
  rollId: string
  rollName: string
  initialImages: ImageRecord[]
  rollSuggestions: string[]
}

export function ChatInterface({ rollId, rollName, initialImages, rollSuggestions }: Props) {
  const [messages, setMessages] = useState<MessageWithFollowups[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const [resultImageIds, setResultImageIds] = useState<string[] | null>(null)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [liveImages, setLiveImages] = useState<ImageRecord[]>(initialImages)
  const liveImageCount = liveImages.length
  // isImagePrompt selects the correct line set; matchCount is set on resolve so
  // the "Found M matches" terminal line appears before the indicator is swapped out.
  const [processing, setProcessing] = useState<{ isImagePrompt: boolean; matchCount?: number } | null>(null)

  // Darkroom state: which images to navigate + which index to open at
  const [darkroom, setDarkroom] = useState<{ images: ImageRecord[]; index: number } | null>(null)

  const [previewOpen, setPreviewOpen] = useState(false)

  const openDarkroom = useCallback((imageId: string, contextImages: ImageRecord[]) => {
    const index = contextImages.findIndex((img) => img.id === imageId)
    if (index === -1) return
    setDarkroom({ images: contextImages, index })
  }, [])

  const suggestions = rollSuggestions.length > 0 ? rollSuggestions : UNIVERSAL_SUGGESTIONS

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    getChatHistory(rollId).then((history) => {
      setMessages(history as MessageWithFollowups[])
      const lastWithResults = [...history].reverse().find(
        (m) => m.role === 'assistant' && m.result_image_ids && m.result_image_ids.length > 0,
      )
      if (lastWithResults?.result_image_ids) {
        setResultImageIds(lastWithResults.result_image_ids as string[])
      }
    }).catch(console.error).finally(() => setHistoryLoaded(true))
  }, [rollId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Core send logic shared by both the text input and chip paths.
  const submitMessage = useCallback(async (text: string, refIds?: string[]) => {
    setSending(true)

    const tempId = `temp-${Date.now()}`
    const optimisticMsg: MessageWithFollowups = {
      id: tempId,
      roll_id: rollId,
      user_id: '',
      role: 'user',
      content: text,
      result_image_ids: null,
      interpreted_filter: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setProcessing({ isImagePrompt: (refIds?.length ?? 0) > 0 })

    try {
      const result = await sendMessage(rollId, text, refIds)
      setProcessing((prev) => prev ? { ...prev, matchCount: result.images.length } : null)
      const assistantMsg: MessageWithFollowups = {
        ...(result.assistantMessage as ChatMessageWithResults),
        followups: result.followups,
      }
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        result.userMessage as MessageWithFollowups,
        assistantMsg,
      ])
      setResultImageIds(result.images.map((img) => img.id))
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSending(false)
      setProcessing(null)
    }
  }, [rollId])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')

    // Gallery management intent — open drawer instead of querying the roll
    if (GALLERY_INTENT_RE.test(text)) {
      window.dispatchEvent(new CustomEvent('hypermood:open-galleries'))
      return
    }

    const refIds = selectedImageIds.length > 0 ? selectedImageIds : undefined
    setSelectedImageIds([])
    await submitMessage(text, refIds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sending, selectedImageIds, submitMessage])

  const handleChipSend = useCallback((text: string) => {
    if (sending) return
    submitMessage(text)
  }, [sending, submitMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const toggleSelected = useCallback((id: string) => {
    setSelectedImageIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const deselect = useCallback((id: string) => {
    setSelectedImageIds((prev) => prev.filter((x) => x !== id))
  }, [])

  const showAll = useCallback(() => {
    setResultImageIds(null)
    setSelectedImageIds([])
  }, [])

  const handleFilterModify = useCallback(async (
    messageId: string,
    plan: QueryPlan,
    modifications: FilterMod[],
  ) => {
    if (sending) return
    setSending(true)
    // Mirror the dimming behavior of a new chat query so the grid enters its filtered state.
    setProcessing({ isImagePrompt: false })

    try {
      const result = await rerunWithModifiedFilters(rollId, plan, modifications)
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId)
        // Preserve the original messageId so the MessageBubble component is not
        // remounted (which would reset filterOpen state and collapse the chip panel).
        const updatedMsg: MessageWithFollowups = {
          ...(result.assistantMessage as ChatMessageWithResults),
          id: messageId,
        }
        if (idx === -1) return [...prev, updatedMsg]
        const next = [...prev]
        next[idx] = updatedMsg
        return next
      })
      setResultImageIds(result.images.map((img) => img.id))
    } catch {
      // Surface nothing to the user — sending clears via finally, chips re-enable.
      // Future: add a toast/error state here.
    } finally {
      setSending(false)
      setProcessing(null)
    }
  }, [rollId, sending])

  // Shared map over live images — used by both previewImages and SelectionStrip
  const imageMap = useMemo(
    () => new Map(liveImages.map((img) => [img.id, img])),
    [liveImages],
  )
  // Selection takes priority over result set — an explicit pick always beats an implicit query result.
  // Falls back to result set, then the full roll.
  const previewImages = useMemo<ImageRecord[]>(() => {
    if (selectedImageIds.length > 0) {
      return selectedImageIds.flatMap((id) => {
        const img = imageMap.get(id)
        return img ? [img] : []
      })
    }
    if (resultImageIds !== null && resultImageIds.length > 0) {
      return resultImageIds.flatMap((id) => {
        const img = imageMap.get(id)
        return img ? [img] : []
      })
    }
    return liveImages
  }, [selectedImageIds, resultImageIds, liveImages, imageMap])

  const canPreview = previewImages.length > 0

  const handleGallerySaved = useCallback((slug: string) => {
    const confirmMsg: MessageWithFollowups = {
      id: `gallery-${Date.now()}`,
      roll_id: rollId,
      user_id: 'local',
      role: 'assistant',
      content: `Gallery saved → /g/${slug}`,
      result_image_ids: null,
      interpreted_filter: null,
      created_at: new Date().toISOString(),
      galleryLink: `/g/${slug}`,
    }
    setMessages((prev) => [...prev, confirmMsg])
  }, [rollId])

  // Space opens preview when focus is not in a text field and there are images to preview
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== ' ' || !canPreview) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      setPreviewOpen(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canPreview])

  const hasConversation = historyLoaded && (messages.length > 0 || !!processing)

  return (
    <div className="flex flex-col h-full">
      {/* Roll header — lives here so liveImageCount stays accurate */}
      <div className="px-10 py-6 shrink-0">
        <h1 className="text-3xl font-medium">{rollName}</h1>
        <p className="text-base font-mono mt-1">{liveImageCount.toLocaleString()} images</p>
      </div>

      <div className="px-10 pb-6 flex flex-col gap-4">
        {hasConversation ? (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                sending={sending}
                onFollowup={handleChipSend}
                onFilterModify={handleFilterModify}
              />
            ))}
            {processing && (
              <ProcessingIndicator
                isImagePrompt={processing.isImagePrompt}
                imageCount={liveImageCount}
                matchCount={processing.matchCount}
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : historyLoaded ? (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleChipSend(s)}
                disabled={sending}
                className="text-base border border-primary-200 rounded-xl px-4 py-2 animate-swiss hover:bg-primary-100 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {resultImageIds !== null && (
          <div className="flex items-center gap-3">
            <span className="text-base font-mono">
              {resultImageIds.length} results from {liveImageCount.toLocaleString()}
            </span>
            <button
              onClick={showAll}
              className="text-base font-mono border border-primary-200 px-3 py-1 rounded-none animate-swiss hover:bg-primary-100"
            >
              Show all
            </button>
            {canPreview && (
              <button
                onClick={() => setPreviewOpen(true)}
                className="text-base font-mono border border-primary-200 px-3 py-1 rounded-none animate-swiss hover:bg-primary-100"
              >
                Preview selection
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 border border-primary-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary-900">
          {selectedImageIds.length > 0 && (
            <SelectionStrip
              selectedIds={selectedImageIds}
              imageMap={imageMap}
              onDeselect={deselect}
            />
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedImageIds.length > 0 ? 'Describe what to find with these as reference…' : 'Ask about this roll…'}
            rows={1}
            disabled={sending}
            className="text-lg w-full resize-none bg-transparent outline-none placeholder:text-primary-200 disabled:opacity-50"
            style={{ minHeight: '1.75rem' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <RollImageGrid
          rollId={rollId}
          initialImages={initialImages}
          resultImageIds={resultImageIds}
          selectedImageIds={selectedImageIds}
          onImageClick={toggleSelected}
          onImagesChange={(imgs) => setLiveImages(imgs)}
          onFullscreen={openDarkroom}
        />
      </div>

      {darkroom && (
        <Darkroom
          images={darkroom.images}
          initialIndex={darkroom.index}
          onClose={() => setDarkroom(null)}
        />
      )}

      {previewOpen && (
        <PreviewPanel
          images={previewImages}
          rollId={rollId}
          onClose={() => setPreviewOpen(false)}
          onGallerySaved={handleGallerySaved}
        />
      )}
    </div>
  )
}

function MessageBubble({
  message,
  sending,
  onFollowup,
  onFilterModify,
}: {
  message: MessageWithFollowups
  sending: boolean
  onFollowup: (text: string) => void
  onFilterModify: (messageId: string, plan: QueryPlan, modifications: FilterMod[]) => void
}) {
  const [filterOpen, setFilterOpen] = useState(false)
  const isUser = message.role === 'user'
  const hasResults = Array.isArray(message.result_image_ids) && message.result_image_ids.length > 0
  const followups = message.followups ?? []

  // ChatMessageWithResults already narrows interpreted_filter to QueryPlan | null.
  const plan = message.interpreted_filter

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[70%] text-lg px-4 py-3 animate-bloom ${
          isUser
            ? 'bg-primary-100 rounded-2xl'
            : 'bg-white rounded-2xl border border-primary-100'
        }`}
      >
        {message.galleryLink ? (
          <p>
            Gallery saved →{' '}
            <a
              href={message.galleryLink}
              className="text-semantic-info underline animate-swiss hover:opacity-70"
              target="_blank"
              rel="noopener noreferrer"
            >
              {message.galleryLink}
            </a>
          </p>
        ) : (
          <p>{message.content}</p>
        )}

        {!isUser && plan && (
          <div className="mt-2">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className="text-base font-mono text-primary-200 animate-swiss hover:text-primary-900"
            >
              {filterOpen ? '▲ hide filter' : '▼ show filter'}
            </button>
            {filterOpen && (
              <FilterChips
                plan={plan}
                disabled={sending}
                onModify={(mods) => onFilterModify(message.id, plan, mods)}
              />
            )}
          </div>
        )}
      </div>

      {!isUser && hasResults && followups.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 max-w-[70%]">
          {followups.map((f) => (
            <button
              key={f}
              onClick={() => onFollowup(f)}
              disabled={sending}
              className="text-base border border-primary-200 rounded-xl px-4 py-1 animate-swiss hover:bg-primary-100 disabled:opacity-50"
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SelectionStrip({
  selectedIds,
  imageMap,
  onDeselect,
}: {
  selectedIds: string[]
  imageMap: Map<string, ImageRecord>
  onDeselect: (id: string) => void
}) {

  return (
    <div className="animate-bloom flex flex-col gap-1 pb-2 border-b border-primary-100">
      <div className="flex flex-row overflow-x-auto gap-1">
        {selectedIds.map((id) => {
          const img = imageMap.get(id)
          if (!img) return null
          const src = getImageUrl(img.storage_key, { width: 40, quality: 70 })

          return (
            <div key={id} className="relative group shrink-0 w-5 h-5">
              <Image
                src={src}
                alt={img.original_filename ?? ''}
                width={20}
                height={20}
                unoptimized
                className="w-5 h-5 rounded-none object-cover"
              />
              <button
                onClick={() => onDeselect(id)}
                className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 animate-swiss"
                aria-label="Deselect"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
      <span className="text-base font-mono">{selectedIds.length} selected</span>
    </div>
  )
}
