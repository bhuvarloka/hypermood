-- Cache for query text embeddings keyed by SHA-256 hash of the text.
-- Rows expire after 30 days via a pg_cron job or on-read eviction in the app.
CREATE TABLE query_embeddings (
  text_hash     text PRIMARY KEY,         -- SHA-256 hex of the query text
  embedding     vector(3072) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT now() + INTERVAL '30 days'
);

-- Fast lookup by expiry for TTL eviction
CREATE INDEX query_embeddings_expires_at_idx ON query_embeddings (expires_at);

-- RLS: this table is internal (server-only reads via service role or SECURITY DEFINER),
-- so lock it down entirely from the anon/authenticated roles.
ALTER TABLE query_embeddings ENABLE ROW LEVEL SECURITY;
-- No policies added — only the service role (used by server actions) can read/write.
