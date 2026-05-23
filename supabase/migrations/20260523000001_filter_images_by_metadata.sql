-- Metadata-only filter RPC. Replaces the JS-side post-filter for queries that have
-- no semantic_search component. The p_where_clause is built server-side from the
-- ALLOWED_METADATA_FIELDS allowlist in query-executor.logic.ts — field names are
-- never taken from raw user input.
CREATE OR REPLACE FUNCTION filter_images_by_metadata(
  p_roll_id      uuid,
  p_where_clause text,
  p_sort_field   text    DEFAULT 'uploaded_at',
  p_sort_asc     boolean DEFAULT false,
  p_limit        int     DEFAULT 50
)
RETURNS SETOF images
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    $q$
      SELECT i.*
      FROM images i
      JOIN image_metadata im ON im.image_id = i.id
      WHERE i.roll_id = %L
        AND i.user_id = auth.uid()
        AND i.status = 'indexed'
        AND (%s)
      ORDER BY i.%I %s
      LIMIT %s
    $q$,
    p_roll_id,
    p_where_clause,
    p_sort_field,
    CASE WHEN p_sort_asc THEN 'ASC' ELSE 'DESC' END,
    p_limit::int
  );
END;
$$;

GRANT EXECUTE ON FUNCTION filter_images_by_metadata(uuid, text, text, boolean, int)
  TO authenticated;
