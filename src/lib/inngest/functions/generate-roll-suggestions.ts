import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRollSuggestions } from '@/lib/suggestions'
export const generateRollSuggestionsJob = inngest.createFunction(
  {
    id: 'generate-roll-suggestions',
    retries: 3,
    triggers: [{ event: 'indexing/complete.roll' }],
  },
  async ({ event, step }) => {
    const { rollId } = event.data as { rollId: string }

    if (!rollId) throw new Error('indexing/complete.roll event missing rollId')

    const suggestions = await step.run('generate-suggestions', async () => {
      return generateRollSuggestions(rollId)
    })

    // Don't overwrite existing suggestions with an empty array — too few indexed
    // images means the stats are thin, not that the roll has no good starters.
    if (suggestions.length === 0) return { rollId, suggestions }

    await step.run('save-suggestions', async () => {
      const supabase = createAdminClient()
      const { error } = await supabase
        .from('rolls')
        .update({ suggestions })
        .eq('id', rollId)

      if (error) throw new Error(`Failed to save suggestions for roll ${rollId}: ${error.message}`)
    })

    return { rollId, suggestions }
  },
)
