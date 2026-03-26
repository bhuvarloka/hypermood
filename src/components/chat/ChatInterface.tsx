'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { sendMessage, getChatHistory } from '@/actions/chat'
import { RollImageGrid } from '@/components/roll/roll-image-grid'
import { ProcessingIndicator } from '@/components/chat/ProcessingIndicator'
import { getImageUrl } from '@/lib/imagekit/url'
import type { ChatMessageWithResults, Image as ImageRecord } from '@/types/domain'

const UNIVERSAL_SUGGESTIONS = [
  'Show me the best shots',
  'Find all portraits',
  "What's in this roll?",
]

type MessageWithFollowups = ChatMessageWithResults & { followups?: string[] }

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
  const [liveImageCount, setLiveImageCount] = useState(initialImages.length)
  // isImagePrompt selects the correct line set; matchCount is set on resolve so
  // the "Found M matches" terminal line appears before the indicator is swapped out.
  const [processing, setProcessing] = useState<{ isImagePrompt: boolean; matchCount?: number } | null>(null)

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
    const refIds = selectedImageIds.length > 0 ? selectedImageIds : undefined
    setSelectedImageIds([])
    await submitMessage(text, refIds)
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
          </div>
        )}

        <div className="flex flex-col gap-2 border border-primary-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary-900">
          {selectedImageIds.length > 0 && (
            <SelectionStrip
              selectedIds={selectedImageIds}
              images={initialImages}
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
          onImagesChange={(imgs) => setLiveImageCount(imgs.length)}
        />
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  sending,
  onFollowup,
}: {
  message: MessageWithFollowups
  sending: boolean
  onFollowup: (text: string) => void
}) {
  const [filterOpen, setFilterOpen] = useState(false)
  const isUser = message.role === 'user'
  const hasResults = Array.isArray(message.result_image_ids) && message.result_image_ids.length > 0
  const followups = message.followups ?? []

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[70%] text-lg px-4 py-3 animate-bloom ${
          isUser
            ? 'bg-primary-100 rounded-2xl'
            : 'bg-white rounded-2xl border border-primary-100'
        }`}
      >
        <p>{message.content}</p>

        {!isUser && message.interpreted_filter && (
          <div className="mt-2">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className="text-base font-mono text-primary-200 animate-swiss hover:text-primary-900"
            >
              {filterOpen ? '▲ hide filter' : '▼ show filter'}
            </button>
            {filterOpen && (
              <pre className="font-mono text-base mt-1 overflow-x-auto text-primary-800 animate-bloom">
                {JSON.stringify(message.interpreted_filter, null, 2)}
              </pre>
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
  images,
  onDeselect,
}: {
  selectedIds: string[]
  images: ImageRecord[]
  onDeselect: (id: string) => void
}) {
  // initialImages can have up to 1000 entries — avoid rebuilding on every toggle
  const imageMap = useMemo(
    () => new Map(images.map((img) => [img.id, img])),
    [images],
  )

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
