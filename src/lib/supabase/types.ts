export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      rolls: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      images: {
        Row: {
          id: string
          roll_id: string
          user_id: string
          storage_key: string
          original_filename: string
          file_size_bytes: number
          mime_type: string
          width: number | null
          height: number | null
          captured_at: string | null
          uploaded_at: string
          status: 'pending' | 'indexing' | 'indexed' | 'failed'
          error_message: string | null
        }
        Insert: {
          id?: string
          roll_id: string
          user_id: string
          storage_key: string
          original_filename: string
          file_size_bytes: number
          mime_type: string
          width?: number | null
          height?: number | null
          captured_at?: string | null
          uploaded_at?: string
          status?: 'pending' | 'indexing' | 'indexed' | 'failed'
          error_message?: string | null
        }
        Update: {
          id?: string
          roll_id?: string
          user_id?: string
          storage_key?: string
          original_filename?: string
          file_size_bytes?: number
          mime_type?: string
          width?: number | null
          height?: number | null
          captured_at?: string | null
          uploaded_at?: string
          status?: 'pending' | 'indexing' | 'indexed' | 'failed'
          error_message?: string | null
        }
      }
      image_metadata: {
        Row: {
          id: string
          image_id: string
          user_id: string
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          image_id: string
          user_id: string
          metadata: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          image_id?: string
          user_id?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      image_embeddings: {
        Row: {
          id: string
          image_id: string
          user_id: string
          embedding: number[]
          embedding_model_version: string
          created_at: string
        }
        Insert: {
          id?: string
          image_id: string
          user_id: string
          embedding: number[]
          embedding_model_version: string
          created_at?: string
        }
        Update: {
          id?: string
          image_id?: string
          user_id?: string
          embedding?: number[]
          embedding_model_version?: string
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          roll_id: string
          user_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          result_image_ids: string[] | null
          interpreted_filter: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          roll_id: string
          user_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          result_image_ids?: string[] | null
          interpreted_filter?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          roll_id?: string
          user_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          result_image_ids?: string[] | null
          interpreted_filter?: Json | null
          created_at?: string
        }
      }
      galleries: {
        Row: {
          id: string
          user_id: string
          roll_id: string
          name: string
          slug: string
          description: string | null
          is_public: boolean
          layout: 'masonry' | 'timeline' | 'grid'
          filter_criteria: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          roll_id: string
          name: string
          slug: string
          description?: string | null
          is_public?: boolean
          layout?: 'masonry' | 'timeline' | 'grid'
          filter_criteria?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          roll_id?: string
          name?: string
          slug?: string
          description?: string | null
          is_public?: boolean
          layout?: 'masonry' | 'timeline' | 'grid'
          filter_criteria?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      gallery_images: {
        Row: {
          id: string
          gallery_id: string
          image_id: string
          position: number
          added_at: string
        }
        Insert: {
          id?: string
          gallery_id: string
          image_id: string
          position: number
          added_at?: string
        }
        Update: {
          id?: string
          gallery_id?: string
          image_id?: string
          position?: number
          added_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
