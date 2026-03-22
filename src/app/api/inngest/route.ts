import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { indexImage } from '@/lib/inngest/functions/index-image'
import { indexRoll } from '@/lib/inngest/functions/index-roll'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [indexImage, indexRoll],
})
