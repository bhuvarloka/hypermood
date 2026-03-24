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

-- Supports the JOIN in search_images_by_embedding_filtered (FK columns are not auto-indexed).
CREATE INDEX idx_image_metadata_image_id ON image_metadata (image_id);

-- ============================================================
-- GRANTS
-- Raw SQL migrations don't auto-grant table access to Supabase roles.
-- RLS policies enforce row-level restrictions on top of these grants.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rolls             TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.images            TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_metadata    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_embeddings  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages     TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.galleries         TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_images    TO anon, authenticated;

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

-- Allow unauthenticated users to read images belonging to public galleries.
-- Required for the nested join in getPublicGallery to return image rows.
CREATE POLICY "images: public select via gallery"
  ON images FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM gallery_images gi
      JOIN galleries g ON g.id = gi.gallery_id
      WHERE gi.image_id = images.id
        AND g.is_public = true
    )
  );

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

-- Public select for galleries marked is_public (no auth required).
CREATE POLICY "galleries: public select"
  ON galleries FOR SELECT
  USING (is_public = true);

-- gallery_images: owner access via gallery ownership check.
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

-- Public select for gallery_images belonging to public galleries.
CREATE POLICY "gallery_images: public select"
  ON gallery_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM galleries g
      WHERE g.id = gallery_id
        AND g.is_public = true
    )
  );

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Vector similarity search for images within a roll (no metadata filters).
-- Returns image_id + similarity score ordered by nearest neighbor (cosine).
CREATE OR REPLACE FUNCTION search_images_by_embedding(
  p_roll_id   uuid,
  p_embedding vector(3072),
  p_limit     int DEFAULT 100
)
RETURNS TABLE (image_id uuid, similarity float)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ie.image_id,
    1 - (ie.embedding <=> p_embedding) AS similarity
  FROM image_embeddings ie
  JOIN images i ON i.id = ie.image_id
  WHERE i.roll_id = p_roll_id
    AND i.user_id = auth.uid()
    AND i.status = 'indexed'
  ORDER BY ie.embedding <=> p_embedding
  LIMIT p_limit;
$$;

-- Vector similarity search combined with JSONB metadata filters.
-- p_where_clause is a SQL fragment built server-side from the ALLOWED_METADATA_FIELDS
-- allowlist in query-executor.ts — field names are never taken from raw user input.
CREATE OR REPLACE FUNCTION search_images_by_embedding_filtered(
  p_roll_id      uuid,
  p_embedding    vector(3072),
  p_where_clause text,
  p_limit        int DEFAULT 100
)
RETURNS TABLE (image_id uuid, similarity float)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    $q$
      SELECT
        ie.image_id,
        1 - (ie.embedding <=> %L::vector) AS similarity
      FROM image_embeddings ie
      JOIN images i ON i.id = ie.image_id
      JOIN image_metadata im ON im.image_id = ie.image_id
      WHERE i.roll_id = %L
        AND i.user_id = auth.uid()
        AND i.status = 'indexed'
        AND (%s)
      ORDER BY ie.embedding <=> %L::vector
      LIMIT %s
    $q$,
    p_embedding,
    p_roll_id,
    p_where_clause,
    p_embedding,
    p_limit::int
  );
END;
$$;

-- Returns up to p_limit indexed image storage_keys per roll, ordered by upload time.
-- ROW_NUMBER() partitioned by roll_id guarantees the cap is enforced per roll,
-- not as a global LIMIT that would starve later rolls of results.
CREATE OR REPLACE FUNCTION get_roll_thumbnails(
  p_roll_ids uuid[],
  p_limit     int DEFAULT 4
)
RETURNS TABLE(roll_id uuid, storage_key text)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT roll_id, storage_key
  FROM (
    SELECT
      i.roll_id,
      i.storage_key,
      ROW_NUMBER() OVER (PARTITION BY i.roll_id ORDER BY i.uploaded_at) AS rn
    FROM images i
    WHERE i.roll_id = ANY(p_roll_ids)
      AND i.status = 'indexed'
  ) ranked
  WHERE rn <= p_limit;
$$;

-- ============================================================
-- REALTIME
-- ============================================================

-- FULL replica identity so UPDATE payloads include changed columns (e.g. status).
ALTER TABLE images        REPLICA IDENTITY FULL;
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

-- Add tables to the realtime publication.
ALTER PUBLICATION supabase_realtime ADD TABLE images;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
