import { AmbientUpload } from '@/components/roll/ambient-upload'
import { ChatInterface } from '@/components/chat/chat-interface'
import type { Image as ImageRecord, Roll } from '@/types/domain'

type Props = {
  rollId: string
  roll: Roll
  initialImages: ImageRecord[]
}

export function CommandCenter({ rollId, roll, initialImages }: Props) {
  const rollSuggestions = Array.isArray(roll.suggestions)
    ? (roll.suggestions as unknown[]).filter((s): s is string => typeof s === 'string')
    : []

  return (
    <AmbientUpload rollId={rollId}>
      <ChatInterface
        rollId={rollId}
        rollName={roll.name}
        initialImages={initialImages}
        rollSuggestions={rollSuggestions}
      />
    </AmbientUpload>
  )
}
