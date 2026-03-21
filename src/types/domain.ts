import type { Json, Tables } from '@/lib/supabase/types'

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

export type ChatMessageWithResults = ChatMessage & {
  result_images?: Image[]
}
