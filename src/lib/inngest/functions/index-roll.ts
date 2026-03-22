import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'

export const indexRoll = inngest.createFunction(
  {
    id: 'index-roll',
    retries: 3,
    triggers: [{ event: 'indexing/start.roll' }],
  },
  async ({ event, step }) => {
    const { rollId } = event.data as { rollId: string }

    if (!rollId) throw new Error('indexing/start.roll event missing rollId')

    const pendingImages = await step.run('fetch-pending-images', async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('images')
        .select('id')
        .eq('roll_id', rollId)
        .eq('status', 'pending')

      if (error) throw new Error(`Failed to fetch pending images for roll ${rollId}: ${error.message}`)
      return data as { id: string }[]
    })

    if (pendingImages.length === 0) {
      return { rollId, dispatched: 0 }
    }

    await step.sendEvent(
      'fan-out-index-image',
      pendingImages.map(({ id }) => ({
        name: 'indexing/process.image',
        data: { imageId: id },
      })),
    )

    return { rollId, dispatched: pendingImages.length }
  },
)
