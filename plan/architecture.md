# Architecture

## Three-Phase Pipeline

```
PHASE 1: INGESTION
User uploads images
  → Files sent to ImageKit (storage + CDN)
  → Metadata row created in Supabase (status: pending)
  → Inngest job triggered per image (batched)
  → Job calls Gemini 3.1 Flash-Lite (vision) → structured metadata extracted
  → Job calls Gemini Embedding 2 → multimodal vector generated
  → Both written to Supabase (status: indexed)
  → Progress broadcast to UI via Supabase Realtime (images.status subscription)

PHASE 2: QUERY
User types natural language in chat (per-roll, persistent history)
  → Query sent to Gemini 3 Flash (text-only, cheap) with:
      - System prompt containing metadata schema + available fields
      - Chat history for context
      - NOT image data, NOT full metadata dump
  → LLM returns structured query plan:
      { filters: [...], semantic_search?: string, sort?: string }
  → App executes plan:
      - Tag/metadata filters → SQL WHERE clauses
      - Semantic search → embed query text → pgvector cosine similarity
      - Combined via scored ranking
  → Results returned as image grid
  → Interpreted filter shown in collapsed/toggleable UI element

IMAGE-AS-PROMPT (variant of Phase 2):
  User selects N reference images + optional text prompt
  → Retrieve stored embeddings of selected images
  → Compute centroid (average vector)
  → If text prompt exists, embed it and blend with centroid (weighted)
  → pgvector nearest-neighbor search using blended vector
  → Additional metadata filters applied if specified
  → Results returned ranked by similarity

PHASE 3: OUTPUT
User saves filtered results as gallery
  → Gallery record created (name, slug, layout, visibility, filter criteria)
  → Junction table links gallery ↔ images with ordering
  → Public URL serves gallery page
  → Images delivered via ImageKit CDN with transforms
```

## Two-Stage Retrieval (Context Window Management)

For rolls with hundreds/thousands of images, the query pipeline uses two stages:

1. **Retrieval stage:** Embed the query → pgvector ANN search → return top K candidates (K=50-100)
2. **Ranking stage:** Send only those K candidates' metadata to the LLM → LLM reranks/filters → return final results

This keeps LLM context small regardless of roll size.

## Indexing: Base Layer Schema

Every image gets this universal analysis via a single structured Gemini 3.1 Flash-Lite call:

```
- objects: array of detected objects with position hints
- people: count, descriptions (clothing, age range, activity)
- colors: dominant palette (hex values), overall tone (warm/cool/neutral)
- scene: environment type, indoor/outdoor, time of day
- mood: emotional tone, energy level
- composition: rule of thirds, symmetry, focal point
- technical: blur score (0-1), exposure quality, noise level
- text_content: any text visible in image (OCR)
- description: one-paragraph natural language summary
- tags: 10-20 freeform semantic tags
```

The vision prompt is a single structured call requesting JSON output. This schema is the base layer. Domain-specific layers (scientific, fashion, etc.) are a post-MVP feature — the architecture supports them by allowing additional metadata to be appended to the same row.

## Storage Abstraction

Images are referenced by a canonical `storage_key` (e.g., `hypermood/rolls/{roll_id}/{filename}`). Never store full URLs in the database.

```
storage_key → getImageUrl(key, transforms?) → full ImageKit URL
```

ImageKit transforms (resize, quality, format) are applied at URL resolution time. Switching CDN providers = changing one utility function.

## Chat Persistence

Each roll has a persistent chat. Messages stored in Supabase:

- `role`: user | assistant | system
- `content`: message text
- `result_image_ids`: array of image IDs returned (if query message)
- `interpreted_filter`: the structured filter the system derived (shown toggleable in UI)

Chat history is sent to the LLM on each query (with a sliding window to respect context limits).

## Suggestion Generation

Two types of suggestions power the conversational UX:

**Roll suggestions (generated once, after indexing):**
After a roll finishes indexing (or after a significant batch completes), a lightweight server-side computation scans the indexed metadata to produce 3-4 contextual starter suggestions. This is NOT an LLM call — it's a SQL aggregation:

- Count images by `scene.setting` (indoor/outdoor split)
- Count images by `people.count` (portraits vs groups vs no-people)
- Extract top 5 most common tags
- Check quality_score distribution (any high-quality cluster?)
- Check time_of_day distribution

From these stats, generate natural-language starters. Store them on the `rolls` table (a `suggestions` JSONB column, nullable). Regenerate on re-index.

**Follow-up suggestions (generated per query):**
The query interpreter prompt (Gemini Flash) is extended to return `suggested_followups: string[]` (2-3 items) alongside the query plan. These are contextual to the current result set and reference what just happened. Stored as part of the assistant message in `chat_messages.content` (or a separate field if preferred).

---

## ADRs (Architecture Decision Records)

### ADR-001: Multi-tenant from day one

**Decision:** Every table includes `user_id` FK. RLS policies enforce isolation.
**Rationale:** Retrofitting RLS is weeks of work. Adding it now is minutes per table.
**Consequence:** Even as single user, all queries go through RLS. Negligible performance impact.

### ADR-002: Inngest for background jobs

**Decision:** Use Inngest for all async work (indexing, embedding, re-indexing).
**Rationale:** Built-in retries, fan-out, progress tracking, rate limiting. Supabase Edge Functions lack retry/orchestration. Vercel Cron is too simple for multi-step jobs.
**Gotcha:** Inngest requires a running server to receive events (Next.js API route). Local dev needs `inngest dev` CLI running alongside `next dev`.
**Consequence:** Switching away means rewriting all async logic.

### ADR-003: Gemini Embedding 2 (single multimodal embedding space)

**Decision:** Use `gemini-embedding-2-preview` for both image and text embeddings.
**Rationale:** First fully multimodal embedding model from Google. Maps text, images, video, audio, and documents into a single unified embedding space. Text queries and image embeddings are directly comparable — no alignment tricks needed. This is what makes image-as-prompt work.
**Predecessor:** `gemini-embedding-exp-03` was deprecated August 2025. `gemini-embedding-001` is text-only and cannot embed images. `gemini-embedding-2-preview` is the correct choice for multimodal use.
**Gotcha:** Model is in preview. If deprecated, all vectors must be regenerated. Store `embedding_model_version` on every vector row.
**Migration approach (do not build, document only):** When switching embedding models: (1) add new vector column, (2) run Inngest batch job to re-embed all images, (3) swap query logic to use new column, (4) drop old column. Never mix vectors from different models in the same search.
**Dimension flexibility:** Gemini Embedding 2 supports Matryoshka Representation Learning (MRL). Default output is 3072 dimensions. Can be truncated to 768 or 1536 via the `output_dimensionality` parameter without re-embedding, trading minimal quality for storage savings. Start with 3072 for MVP.
**Consequence:** Re-embedding 1000 images is ~$0.02 and ~10 minutes. Acceptable cost for model migration.

### ADR-004: pgvector in Supabase (not a dedicated vector DB)

**Decision:** Use pgvector extension in the existing Supabase Postgres instance.
**Rationale:** Eliminates an extra service. At MVP scale (≤1000 images/roll), pgvector with HNSW index is more than sufficient.
**Gotcha:** Vector dimensions must be declared at column creation. If embedding model changes dimension size, column must be recreated.
**Scale ceiling:** ~100K vectors performs well. Beyond that, consider dedicated vector DB.

### ADR-005: No vision calls at query time

**Decision:** Queries only touch the metadata DB and embedding vectors. Never send images back to a vision model during search/filter.
**Rationale:** Cost control (vision calls are 10-100x more expensive than text/embedding calls). Latency (DB query = ms, vision call = seconds). Predictable pricing.
**Exception:** The query _interpreter_ (NL→filter translation) is a text-only LLM call via Gemini 3 Flash. This is cheap and acceptable.

### ADR-006: EXIF-first ordering with upload fallback

**Decision:** Timeline views sort by EXIF `DateTimeOriginal`. If absent, fall back to upload timestamp.
**Rationale:** Photos from cameras/phones have EXIF. Screenshots, downloaded images, and scientific images often don't.
**Implementation:** Extract EXIF at upload time, store `captured_at` (nullable) alongside `uploaded_at`. Sort: `COALESCE(captured_at, uploaded_at)`.

### ADR-007: Supabase Realtime for indexing progress and chat sync

**Decision:** Enable Realtime on `images` and `chat_messages` tables only.
**Rationale:** Indexing progress is the first user impression — polling at 1s intervals per user during upload is wasteful and produces choppy UX. Realtime broadcasts status changes ~50ms after Inngest writes them. Chat sync enables seamless multi-tab usage at no extra cost.
**What NOT to Realtime:** `image_metadata` and `image_embeddings` (written once, never modified). Rolls list (aggregates don't broadcast). Public gallery pages (immutable, no auth).
**Implementation note:** `REPLICA IDENTITY FULL` is required on both tables so UPDATE payloads carry changed columns. Tables must be added to the `supabase_realtime` publication.
**Frontend pattern:** Browser Supabase client subscribes in `useEffect`; server client cannot subscribe. Always unsubscribe on component unmount.
