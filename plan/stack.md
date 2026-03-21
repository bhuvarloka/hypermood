# Tech Stack

## Core

| Technology    | Version/Detail                  | Purpose                                                                        |
| ------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| Next.js       | 16 (App Router)                 | Framework. Server Actions for mutations, Route Handlers for Inngest.           |
| TypeScript    | 5.x (strict mode)               | Language throughout. No `any` unless explicitly justified.                     |
| Supabase      | Hosted (JS SDK v2)              | Database (Postgres), Auth (OTP), RLS, pgvector, Realtime (for progress).       |
| pgvector      | Supabase extension              | Vector similarity search for embeddings.                                       |
| ImageKit      | imagekit.io                     | Image storage, CDN delivery, on-the-fly transforms.                            |
| Google Gemini | `gemini-3.1-flash-lite-preview` | Vision analysis (indexing). Multimodal, 1M context, $0.25/$1.50 per 1M tokens. |
| Google Gemini | `gemini-3-flash-preview`        | Text-only query interpretation (NL→filter).                                    |
| Google Gemini | `gemini-embedding-2-preview`    | Multimodal embeddings (text + image in same space, 3072 dimensions).           |
| Inngest       | v4                              | Background job orchestration (indexing pipeline, retries, fan-out).            |
| Tailwind CSS  | v4                              | Styling. Hand-built components, no component library.                          |

## SDKs

| Package                 | Purpose                                                 |
| ----------------------- | ------------------------------------------------------- |
| `@google/genai`         | Gemini API (vision, text, embeddings) — new unified SDK |
| `@supabase/supabase-js` | Supabase client                                         |
| `@supabase/ssr`         | Supabase server-side auth helpers for Next.js           |
| `@imagekit/next`        | ImageKit React components + upload                      |
| `inngest`               | Inngest SDK for defining/triggering functions           |
| `exifr`                 | EXIF extraction from uploaded images                    |

## Gotchas

**Next.js 16:**

- App Router is stable. Server Actions work for mutations. Don't use Route Handlers for things Server Actions can do.
- `next/image` does not natively support ImageKit. Use ImageKit's own component or raw `<img>` with their URL builder.

**Supabase pgvector:**

- Must enable the `vector` extension manually in Supabase dashboard (or via migration SQL).
- Vector column dimension is fixed at creation: `embedding vector(3072)`. Changing dimensions = recreate column.
- Use `<=>` operator for cosine distance (not `<->` which is L2).
- Create an HNSW index for fast ANN search: `CREATE INDEX ON image_embeddings USING hnsw (embedding vector_cosine_ops)`.

**Gemini `gemini-3.1-flash-lite-preview` (vision):**

- Currently in preview (launched March 3, 2026). Model string may change when it goes GA — keep it in an env var.
- Supports text, image, video, audio, PDF input. 1M token context window, 64K output.
- Supports thinking levels (minimal/low/medium/high). For indexing, use `minimal` to keep costs and latency low.
- Predecessor `gemini-2.0-flash-lite` is being retired June 1, 2026. Do not use it.

**Gemini `gemini-3-flash-preview` (query):**

- Gemini 3 Flash with strong reasoning. Used only for text-only query interpretation (NL→filter).
- Supports thinking levels. For query interpretation, `low` is sufficient.

**Gemini `gemini-embedding-2-preview` (embeddings):**

- First fully multimodal embedding model — maps text, images, video, audio, and documents into a single unified embedding space. This is what makes image-as-prompt work.
- Returns 3072-dimensional vectors by default. Supports MRL (Matryoshka) — can truncate to 768 or 1536 without re-embedding if storage is a concern.
- For images: send as inline_data (base64), supports PNG and JPEG, up to 6 images per request.
- For text: send as plain text content, up to 8192 input tokens.
- Preview model — may be renamed or versioned. Track model version per row via `embedding_model_version`.
- Predecessor `gemini-embedding-exp-03` was deprecated August 2025. `gemini-embedding-001` is text-only (won't work for image embeddings).

**Inngest:**

- Requires an API route in Next.js to serve functions: `app/api/inngest/route.ts`.
- Local dev requires `pnpm dlx inngest-cli@latest dev` running alongside `next dev`.
- Rate limiting for Gemini API calls: use Inngest's built-in `rateLimit` or `concurrency` options to avoid 429s.
- Fan-out pattern: one "start indexing" event triggers individual "index image" functions per image.

**ImageKit:**

- Upload via server-side SDK (not client-side for security).
- URL-based transforms: append `?tr=w-800,h-600,q-80,f-auto` to URLs.
- Free tier: 20GB bandwidth/month. Sufficient for MVP.

**Supabase Auth (OTP):**

- OTP login sends a magic link or code to email. No password storage.
- Session management via `@supabase/ssr` middleware in Next.js.
- RLS policies use `auth.uid()` — works automatically when client is initialized with session.
