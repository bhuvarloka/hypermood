-- Enable pgvector extension (must be enabled in Supabase dashboard first)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE rolls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE images (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_id           uuid NOT NULL REFERENCES rolls(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_key       text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  file_size_bytes   int NOT NULL,
  mime_type         text NOT NULL,
  width             int,
  height            int,
  captured_at       timestamptz,
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'indexing', 'indexed', 'failed')),
  error_message     text
);

CREATE TABLE image_metadata (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id   uuid NOT NULL UNIQUE REFERENCES images(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metadata   jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE image_embeddings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id                uuid NOT NULL UNIQUE REFERENCES images(id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding               vector(3072) NOT NULL,
  embedding_model_version text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_id            uuid NOT NULL REFERENCES rolls(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role               text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content            text NOT NULL,
  result_image_ids   uuid[],
  interpreted_filter jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE galleries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roll_id          uuid NOT NULL REFERENCES rolls(id) ON DELETE CASCADE,
  name             text NOT NULL,
  slug             text NOT NULL,
  description      text,
  is_public        boolean NOT NULL DEFAULT false,
  layout           text NOT NULL DEFAULT 'masonry' CHECK (layout IN ('masonry', 'timeline', 'grid')),
  filter_criteria  jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gallery_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  image_id   uuid NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  position   int NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gallery_id, image_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- HNSW requires ≤2000 dims for vector; cast to halfvec to support 3072-dim embeddings
CREATE INDEX image_embeddings_embedding_idx
  ON image_embeddings
  USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE INDEX images_roll_id_idx ON images (roll_id);
CREATE INDEX images_status_idx ON images (status);
CREATE INDEX chat_messages_roll_id_created_at_idx ON chat_messages (roll_id, created_at);

CREATE UNIQUE INDEX galleries_user_id_slug_idx ON galleries (user_id, slug);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE rolls             ENABLE ROW LEVEL SECURITY;
ALTER TABLE images            ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_metadata    ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_embeddings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE galleries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rolls: owner access"
  ON rolls FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "images: owner access"
  ON images FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "image_metadata: owner access"
  ON image_metadata FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "image_embeddings: owner access"
  ON image_embeddings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_messages: owner access"
  ON chat_messages FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "galleries: owner access"
  ON galleries FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- galleries: public select for is_public galleries (no auth required)
CREATE POLICY "galleries: public select"
  ON galleries FOR SELECT
  USING (is_public = true);

-- gallery_images: owner access (via gallery ownership)
CREATE POLICY "gallery_images: owner access"
  ON gallery_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM galleries g
      WHERE g.id = gallery_id
        AND g.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM galleries g
      WHERE g.id = gallery_id
        AND g.user_id = auth.uid()
    )
  );

-- gallery_images: public select for images in public galleries
CREATE POLICY "gallery_images: public select"
  ON gallery_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM galleries g
      WHERE g.id = gallery_id
        AND g.is_public = true
    )
  );
