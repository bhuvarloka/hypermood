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
  images: Image[]
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

export type Position =
  | 'center'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export type DetectedObject = {
  label: string
  prominence: ObjectProminence
  position: Position
  attributes: string[]
}

export type AgeRange =
  | 'child'
  | 'teenager'
  | 'young adult'
  | 'middle-aged'
  | 'elderly'
  | 'unknown'

export type GenderPresentation = 'masculine' | 'feminine' | 'ambiguous'

export type PersonDescription = {
  position: Position
  age_range: AgeRange
  gender_presentation: GenderPresentation
  clothing: string[]
  activity: string
  expression: string
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

export type Weather =
  | 'clear'
  | 'cloudy'
  | 'overcast'
  | 'rainy'
  | 'snowy'
  | 'foggy'
  | 'not applicable'
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

export type Symmetry = 'symmetric' | 'asymmetric' | 'radial' | 'pattern/repetition'

export type Depth =
  | 'shallow (blurred background)'
  | 'deep (all in focus)'
  | 'layered (foreground/midground/background)'
  | 'flat (2D/graphic)'

export type Exposure = 'underexposed' | 'well-exposed' | 'overexposed' | 'mixed/HDR'

export type NoiseLevel = 'clean' | 'slight grain' | 'noisy' | 'very noisy'

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
    descriptions: PersonDescription[]
  }
  relationships: string[]
  colors: {
    dominant: string[]
    palette_mood: PaletteMood
    dominant_color_name: string
  }
  scene: {
    environment: string
    setting: Setting
    time_of_day: TimeOfDay
    weather: Weather
  }
  mood: {
    emotional_tone: string
    energy_level: number
    aesthetic_style: string
  }
  composition: {
    framing: Framing
    focal_point: string
    symmetry: Symmetry
    depth: Depth
  }
  technical: {
    blur_score: number
    exposure: Exposure
    noise_level: NoiseLevel
    is_screenshot: boolean
    is_graphic: boolean
    orientation: Orientation
  }
  quality_score: number
  texture_material: string[]
  text_content: {
    has_text: boolean
    text_strings: string[]
    text_role: TextRole
  }
  description: string
  tags: string[]
}
