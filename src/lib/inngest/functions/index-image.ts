import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { getImageUrl } from '@/lib/imagekit/url'
import { analyzeImage } from '@/lib/gemini/vision'
import { embedImage, EMBEDDING_MODEL_VERSION } from '@/lib/gemini/embedding'
import type { Json, TablesUpdate } from '@/lib/supabase/types'

type ImageRow = {
  id: string
  roll_id: string
  user_id: string
  storage_key: string
  original_filename: string
  status: string
}

export const indexImage = inngest.createFunction(
  {
    id: 'index-image',
    concurrency: { limit: 5 },
    retries: 3,
    triggers: [{ event: 'indexing/process.image' }],
    onFailure: async ({ event }) => {
      const { imageId } = event.data.event.data as { imageId?: string }
      const errorMessage = event.data.error.message ?? 'Unknown error'
      // Guard against a missing or invalid imageId — without this, an undefined
      // id would match all rows and mark every image as failed.
      if (!imageId) return
      const supabase = createAdminClient()
      const update: TablesUpdate<'images'> = { status: 'failed', error_message: errorMessage }
      await supabase
        .from('images')
        .update(update as never)
        .eq('id', imageId)
    },
  },
  async ({ event, step }) => {
    const { imageId } = event.data as { imageId: string }

    const image = await step.run('fetch-image', async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from('images')
        .select('id, roll_id, user_id, storage_key, original_filename, status')
        .eq('id', imageId)
        .single()

      if (error) throw new Error(`Failed to fetch image ${imageId}: ${error.message}`)
      return data as ImageRow
    })

    await step.run('set-status-indexing', async () => {
      const supabase = createAdminClient()
      const { error } = await supabase
        .from('images')
        .update({ status: 'indexing' } as TablesUpdate<'images'> as never)
        .eq('id', imageId)
      if (error) throw new Error(`Failed to update status: ${error.message}`)
    })

    const { metadata, embedding } = await step.run('analyze-and-embed', async () => {
      const url = getImageUrl(image.storage_key)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to download image: ${response.status}`)
      const buffer = Buffer.from(await response.arrayBuffer())

      // Run vision analysis and embedding in parallel to cut per-image latency
      const [analysisResult, embeddingResult] = await Promise.all([
        analyzeImage(buffer),
        embedImage(buffer),
      ])

      if (!analysisResult) throw new Error('Vision analysis returned null')
      return { metadata: analysisResult, embedding: embeddingResult }
    })

    await step.run('save-metadata', async () => {
      const supabase = createAdminClient()
      const { error } = await supabase
        .from('image_metadata')
        .upsert({
          image_id: imageId,
          user_id: image.user_id,
          metadata: metadata as unknown as Json,
        } as never, { onConflict: 'image_id' })

      if (error) throw new Error(`Failed to save metadata: ${error.message}`)
    })

    await step.run('save-embedding', async () => {
      const supabase = createAdminClient()
      const { error } = await supabase
        .from('image_embeddings')
        .upsert({
          image_id: imageId,
          user_id: image.user_id,
          embedding,
          embedding_model_version: EMBEDDING_MODEL_VERSION,
        } as never, { onConflict: 'image_id' })

      if (error) throw new Error(`Failed to save embedding: ${error.message}`)
    })

    await step.run('set-status-indexed', async () => {
      const supabase = createAdminClient()
      const { error } = await supabase
        .from('images')
        .update({ status: 'indexed' } as TablesUpdate<'images'> as never)
        .eq('id', imageId)
      if (error) throw new Error(`Failed to update status: ${error.message}`)
    })

    // After marking this image indexed, check whether all images in the roll
    // have settled (no more pending or indexing). If so, fire the roll
    // completion event to trigger suggestion generation.
    const isRollComplete = await step.run('check-roll-complete', async () => {
      const supabase = createAdminClient()
      const { count, error } = await supabase
        .from('images')
        .select('id', { count: 'exact', head: true })
        .eq('roll_id', image.roll_id)
        .in('status', ['pending', 'indexing'])

      if (error) throw new Error(`Failed to check roll completion: ${error.message}`)
      if (count === null) throw new Error(`Unexpected null count for roll ${image.roll_id}`)
      return count === 0
    })

    if (isRollComplete) {
      await step.sendEvent('fire-roll-complete', {
        name: 'indexing/complete.roll',
        data: { rollId: image.roll_id },
        // Deduplication: scoped to a 5-minute window (UTC minute rounded down to
        // the nearest 5) so simultaneous last-image completions collapse to one
        // event, while a re-index triggered minutes later still fires correctly.
        id: `roll-complete-${image.roll_id}-${Math.floor(Date.now() / 300_000)}`,
      })
    }

    return { imageId, status: 'indexed' }
  },
)
