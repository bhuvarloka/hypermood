import type { Json, Tables } from '@/lib/supabase/types'
import type { QueryPlan } from '@/lib/gemini/query'

export type Roll = Tables<'rolls'>

export type ImageStatus = 'pending' | 'indexing' | 'indexed' | 'failed'

export type Image = Tables<'images'>

export type ImageMetadata = Tables<'image_metadata'>

export type ImageEmbedding = Omit<Tables<'image_embeddings'>, 'embedding'> & {
  // Typed as number[] in the DB layer; embedding vectors are never sent to the client.
  embedding: number[]
}

export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatMessage = Tables<'chat_messages'>

export type GalleryLayout = 'masonry' | 'timeline' | 'grid'

export type Gallery = Tables<'galleries'>

export type GalleryImage = Tables<'gallery_images'>

// Enriched types used when joining across tables

export type RollWithImageCount = Roll & {
  image_count: number
  indexed_count: number
}

export type ImageWithMetadata = Image & {
  metadata: Json | null
}

export type GalleryWithImages = Gallery & {
  images: (Image & { subject?: string | null })[]
  roll_name?: string | null
}

export type GalleryListItem = Gallery & {
  image_count: number
  thumbnail_keys: string[]
}

export type ChatMessageWithResults = ChatMessage & {
  result_images?: Image[]
  // interpreted_filter is Json | null in the DB layer; this enriched type narrows
  // it so UI components can consume the filter structure without unsafe casts.
  interpreted_filter: QueryPlan | null
}

// -- Base Layer Metadata (Vision Indexing Schema) --

export type ObjectProminence = 'primary' | 'secondary' | 'background'

export type DetectedObject = {
  label: string
  prominence: ObjectProminence
}

export type PaletteMood =
  | 'warm'
  | 'cool'
  | 'neutral'
  | 'mixed'
  | 'monochromatic'
  | 'vibrant'
  | 'muted'
  | 'pastel'
  | 'dark'
  | 'high-contrast'

export type Setting = 'indoor' | 'outdoor' | 'mixed' | 'not applicable'

export type TimeOfDay =
  | 'dawn'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'golden hour'
  | 'sunset'
  | 'dusk'
  | 'night'
  | 'artificial lighting'
  | 'unknown'

export type Framing =
  | 'extreme close-up'
  | 'close-up'
  | 'medium close-up'
  | 'medium shot'
  | 'medium wide'
  | 'wide shot'
  | 'extreme wide'
  | 'overhead'
  | 'birds-eye'
  | 'flat lay'

export type Orientation = 'landscape' | 'portrait' | 'square'

export type TextRole =
  | 'signage'
  | 'label'
  | 'overlay/graphic'
  | 'document'
  | 'watermark'
  | 'incidental'
  | 'none'

export type BaseLayerMetadata = {
  subject: string
  objects: DetectedObject[]
  people: {
    count: number
  }
  colors: {
    dominant: string[]
    palette_mood: PaletteMood
    dominant_color_name: string
  }
  scene: {
    setting: Setting
    time_of_day: TimeOfDay
  }
  composition: {
    framing: Framing
  }
  technical: {
    is_screenshot: boolean
    is_graphic: boolean
    orientation: Orientation
  }
  quality_score: number
  text_content: {
    has_text: boolean
    text_strings: string[]
    text_role: TextRole
  }
  description: string
  tags: string[]
}
