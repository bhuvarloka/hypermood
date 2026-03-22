'use server'

import { createClient } from '@/lib/supabase/server'
import { interpretQuery } from '@/lib/gemini/query'
import { executeQuery } from '@/lib/gemini/query-executor'
import { searchByImageReferences } from '@/lib/gemini/image-search'
import type { ChatMessage, Image } from '@/types/domain'
import type { Json, TablesInsert } from '@/lib/supabase/types'
import type { QueryPlan } from '@/lib/gemini/query'

const CHAT_HISTORY_CONTEXT_LIMIT = 20
const CHAT_HISTORY_PAGE_SIZE = 50

export type SendMessageResult = {
  message: ChatMessage
  images: Image[]
  total: number
  // Null when image-as-prompt path was used (no structured filter to show).
  interpretedFilter: QueryPlan | null
}

export async function sendMessage(
  rollId: string,
  text: string,
  referenceImageIds?: string[],
): Promise<SendMessageResult> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  // Fetch history before saving the user message so the current turn does not
  // appear twice in the context passed to interpretQuery (once in history, once
  // as the explicit "Current query").
  const { data: historyRows, error: historyError } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('roll_id', rollId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(CHAT_HISTORY_CONTEXT_LIMIT)

  if (historyError) throw new Error(`Failed to fetch chat history: ${historyError.message}`)

  // Reverse to chronological order (oldest first) for the model.
  const history = ((historyRows ?? []) as ChatMessage[]).reverse()

  const userRow: TablesInsert<'chat_messages'> = {
    roll_id: rollId,
    user_id: user.id,
    role: 'user',
    content: text,
  }

  const { data: savedUserMsg, error: userMsgError } = await supabase
    .from('chat_messages')
    .insert(userRow as never)
    .select()
    .single()

  if (userMsgError || !savedUserMsg) {
    throw new Error(`Failed to save user message: ${userMsgError?.message}`)
  }

  let resultImages: Image[]
  let total: number
  let interpretedFilter: QueryPlan | null = null

  const hasReferenceImages = referenceImageIds && referenceImageIds.length > 0

  if (hasReferenceImages) {
    resultImages = await searchByImageReferences(referenceImageIds, rollId, text || undefined)
    total = resultImages.length
  } else {
    const plan = await interpretQuery(text, history)
    interpretedFilter = plan
    const queryResult = await executeQuery(plan, rollId)
    resultImages = queryResult.images
    total = queryResult.total
  }

  const resultImageIds = resultImages.map(img => img.id)
  const assistantContent = buildAssistantContent(total, interpretedFilter)

  const assistantRow: TablesInsert<'chat_messages'> = {
    roll_id: rollId,
    user_id: user.id,
    role: 'assistant',
    content: assistantContent,
    result_image_ids: resultImageIds.length > 0 ? resultImageIds : null,
    interpreted_filter: interpretedFilter ? (interpretedFilter as unknown as Json) : null,
  }

  const { data: savedAssistantMsg, error: assistantMsgError } = await supabase
    .from('chat_messages')
    .insert(assistantRow as never)
    .select()
    .single()

  if (assistantMsgError || !savedAssistantMsg) {
    throw new Error(`Failed to save assistant message: ${assistantMsgError?.message}`)
  }

  return {
    message: savedAssistantMsg as ChatMessage,
    images: resultImages,
    total,
    interpretedFilter,
  }
}

// Returns a page of chat history in chronological order (oldest first).
// Page 0 = most recent CHAT_HISTORY_PAGE_SIZE messages.
// Page 1 = the next-older page, to be prepended before page 0 in the UI.
// Use a before_timestamp cursor for reliable real-time pagination when new
// messages arrive during a session; this offset-based variant is safe for
// initial load where the history is stable.
export async function getChatHistory(
  rollId: string,
  page = 0,
): Promise<ChatMessage[]> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  // Fetch newest-first so the DB can use the (roll_id, created_at) index
  // efficiently. Reverse before returning so callers always receive
  // chronological order regardless of which page they requested.
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('roll_id', rollId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(page * CHAT_HISTORY_PAGE_SIZE, (page + 1) * CHAT_HISTORY_PAGE_SIZE - 1)

  if (error) throw new Error(`Failed to fetch chat history: ${error.message}`)

  return ((data ?? []) as ChatMessage[]).reverse()
}

function buildAssistantContent(resultCount: number, plan: QueryPlan | null): string {
  if (resultCount === 0) {
    if (plan?.clarification_note) return plan.clarification_note
    return "I couldn't find any images matching your query. Try broadening the description or using different keywords."
  }

  if (plan?.clarification_note) {
    return `${plan.clarification_note} Found ${resultCount} image${resultCount === 1 ? '' : 's'}.`
  }

  return `Found ${resultCount} image${resultCount === 1 ? '' : 's'}.`
}
