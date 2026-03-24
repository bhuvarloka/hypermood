# Implementation Tasks

Each task is one focused AI prompt. No task depends on anything below it. Read the referenced `plan/` file before starting each task.

---

## Phase 1: Foundation ✅

### Task 1 — Project scaffold

**Read:** `plan/dev.md`, `plan/structure.md`
**Do:** Initialize Next.js 16 project with TypeScript, Tailwind, App Router, src directory. Install all dependencies listed in `plan/stack.md`. Create folder structure from `plan/structure.md`. Set up path alias `@/` in tsconfig. Create `.env.local.example` with all required env vars (no values). Add `.env.local` to `.gitignore`.
**Output:** Running `pnpm dev` shows the default Next.js page. All folders exist.

### Task 2 — Database schema + RLS

**Read:** `plan/architecture.md`, `plan/glossary.md`
**Do:** Write SQL migration that creates all tables:

**`rolls`**: id (uuid, PK), user_id (uuid, FK auth.users), name (text), description (text, nullable), created_at, updated_at.

**`images`**: id (uuid, PK), roll_id (uuid, FK rolls), user_id (uuid, FK auth.users), storage_key (text, unique), original_filename (text), file_size_bytes (int), mime_type (text), width (int, nullable), height (int, nullable), captured_at (timestamptz, nullable — from EXIF), uploaded_at (timestamptz, default now), status (text, default 'pending' — enum: pending, indexing, indexed, failed), error_message (text, nullable).

**`image_metadata`**: id (uuid, PK), image_id (uuid, FK images, unique), user_id (uuid, FK auth.users), metadata (jsonb — the base layer structured output), created_at, updated_at.

**`image_embeddings`**: id (uuid, PK), image_id (uuid, FK images, unique), user_id (uuid, FK auth.users), embedding (vector(3072)), embedding_model_version (text), created_at.

**`chat_messages`**: id (uuid, PK), roll_id (uuid, FK rolls), user_id (uuid, FK auth.users), role (text — user/assistant/system), content (text), result_image_ids (uuid[], nullable), interpreted_filter (jsonb, nullable), created_at.

**`galleries`**: id (uuid, PK), user_id (uuid, FK auth.users), roll_id (uuid, FK rolls), name (text), slug (text, unique per user), description (text, nullable), is_public (boolean, default false), layout (text, default 'masonry', CHECK IN ('masonry', 'timeline', 'grid')), filter_criteria (jsonb, nullable — stores the query that generated this gallery), created_at, updated_at.

**`gallery_images`**: id (uuid, PK), gallery_id (uuid, FK galleries), image_id (uuid, FK images), position (int), added_at (timestamptz, default now). Unique constraint on (gallery_id, image_id).

Add RLS policies on every table: `WHERE user_id = auth.uid()` for select/insert/update/delete. Exception: `galleries` and `gallery_images` need a public select policy for rows where `galleries.is_public = true` (for public gallery pages).

Create HNSW index on `image_embeddings.embedding` using `vector_cosine_ops`.
Create index on `images.roll_id` and `images.status`.
Create index on `chat_messages.roll_id` + `created_at`.
Create unique index on `galleries(user_id, slug)`.

**Output:** Migration SQL file in `supabase/migrations/`. Run it against Supabase.

### Task 3 — Supabase clients + type generation

**Read:** `plan/stack.md` (Supabase gotchas)
**Do:** Create three Supabase client files:

- `lib/supabase/client.ts` — browser client (uses anon key + cookie-based auth)
- `lib/supabase/server.ts` — server client for Server Actions/RSC (reads cookies)
- `lib/supabase/admin.ts` — service role client (for Inngest jobs, bypasses RLS)

Generate TypeScript types from the database schema and save to `lib/supabase/types.ts`:

```bash
pnpm dlx supabase gen types typescript --project-id yaspacaksjfihuhxnvwo > src/lib/supabase/types.ts
```

Create `src/types/domain.ts` with application-level types that map to DB rows (Roll, Image, ImageMetadata, ChatMessage, Gallery, etc.).

**Output:** Clients importable, types available.

### Task 4 — Auth (OTP login + middleware)

**Read:** `plan/stack.md` (Supabase Auth gotchas)
**Do:** Create Next.js middleware that protects `/(app)/*` routes — redirects to `/login` if no session. Create a minimal login page at `(auth)/login/page.tsx` with email OTP input. After successful OTP verification, redirect to `/rolls`. No styling needed yet — functional only.
**Output:** Can log in via email OTP, session persists, protected routes redirect.

---

## Phase 2: Storage + Indexing Pipeline ✅

### Task 5 — ImageKit upload utility

**Read:** `plan/architecture.md` §Storage Abstraction
**Do:** Create `lib/imagekit/upload.ts` — server-side function that takes a File/Buffer + roll ID, uploads to ImageKit under `hypermood/rolls/{rollId}/{filename}`, returns the `storage_key`. Create `lib/imagekit/url.ts` — `getImageUrl(storageKey, transforms?)` that resolves a storage key to a full ImageKit delivery URL with optional transforms (width, height, quality). Define a `ImageTransforms` type.
**Output:** Can upload a file and resolve its URL with transforms.

### Task 6 — EXIF extraction utility

**Do:** Create a utility that takes an image buffer, extracts EXIF data using `exifr`, and returns `{ capturedAt: Date | null, width: number | null, height: number | null }`. Handle cases where EXIF is missing or malformed gracefully (return nulls).
**Output:** Utility function importable and tested.

### Task 7 — Gemini vision indexing prompt

**Read:** `plan/architecture.md` §Indexing Base Layer Schema
**Do:** Create `lib/gemini/vision.ts`. Define the base layer metadata TypeScript type matching the schema in architecture.md. Write the prompt for `gemini-3.1-flash-lite-preview` that takes an image (as base64) and returns structured JSON matching the base layer schema. Use `thinking_level: 'minimal'` to keep cost and latency low. Include a robust JSON parser that handles: missing fields (fill defaults), extra fields (ignore), malformed JSON (attempt repair, else mark as failed). The prompt must explicitly request JSON output and specify every field.
**⚠️ Complexity flag:** The prompt engineering here is critical — the quality of the index depends entirely on this prompt. Iterate on it. Test with diverse images (photos, screenshots, illustrations, dark images, text-heavy images).
The prompt can be found on `plan/prompt.md`
**Output:** Function: `analyzeImage(imageBuffer: Buffer) → Promise<BaseLayerMetadata | null>`

### Task 8 — Gemini embedding utility

**Read:** `plan/architecture.md` §ADR-003
**Do:** Create `lib/gemini/embedding.ts`. Function that takes an image buffer OR text string and returns a 3072-dimensional vector using `gemini-embedding-2-preview`. For images: send as inline_data (base64, PNG or JPEG). For text: send as plain string content. Return the vector as `number[]`. Include the model version string as a constant (`EMBEDDING_MODEL_VERSION = 'gemini-embedding-2-preview'`) for storage alongside vectors.
**Note:** This model supports multimodal input natively — both image and text embeddings land in the same vector space. This is what makes image-as-prompt work (cosine similarity between an image embedding and a text embedding is meaningful).
**Output:** Functions: `embedImage(buffer: Buffer) → Promise<number[]>`, `embedText(text: string) → Promise<number[]>`

### Task 9 — Inngest setup + index-image function

**Read:** `plan/stack.md` (Inngest gotchas), `plan/architecture.md` §ADR-002
**Do:** Create `lib/inngest/client.ts` — Inngest client instance. Create the API route at `app/api/inngest/route.ts`. Create `lib/inngest/functions/index-image.ts` — an Inngest function triggered by `indexing/process.image` event. The function:

1. Receives `imageId` in event data
2. Fetches the image row from Supabase (via admin client)
3. Downloads the image from ImageKit
4. Updates status to `indexing`
5. Calls `analyzeImage()` from Task 7 → saves metadata to `image_metadata`
6. Calls `embedImage()` from Task 8 → saves embedding to `image_embeddings` with model version
7. Updates image status to `indexed`
8. On any failure: updates status to `failed` with error_message, relies on Inngest retry

Configure concurrency limit to avoid Gemini rate limiting (e.g., max 5 concurrent).
**Output:** Function registered and visible in Inngest dev dashboard.

### Task 10 — Index-roll fan-out function

**Read:** `plan/architecture.md` §Pipeline Phase 1
**Do:** Create `lib/inngest/functions/index-roll.ts` — triggered by `indexing/start.roll` event. Receives `rollId`. Fetches all images in the roll with status `pending`. Sends one `indexing/process.image` event per image (fan-out). This triggers Task 9's function for each image in parallel (within concurrency limits).
**Output:** Triggering one event indexes an entire roll.

### Task 11 — Upload Server Action (ties it together)

**Read:** `plan/structure.md` (anti-patterns)
**Do:** Create `actions/images.ts` with a `uploadImages` Server Action. It:

1. Accepts FormData with multiple image files + rollId
2. For each image: extracts EXIF (Task 6), uploads to ImageKit (Task 5), creates `images` row in Supabase (with EXIF data, storage_key, status: pending)
3. After all rows created, sends `indexing/start.roll` event to Inngest (Task 10)
4. Returns the created image IDs

Create `actions/rolls.ts` with `createRoll` and `listRolls` Server Actions.
**Output:** Full upload pipeline works end-to-end: files → ImageKit → DB → Inngest → indexed.

---

## Phase 3: Query Engine ✅

### Task 12 — Query interpreter (NL → filter)

**Read:** `plan/architecture.md` §Two-Stage Retrieval, §Pipeline Phase 2
**Do:** Create `lib/gemini/query.ts`. Takes a natural language query string + the base layer metadata schema definition + chat history (last N messages). Sends to `gemini-3-flash-preview` (text-only) with a system prompt that explains the metadata fields and asks it to return a structured JSON query plan:

```
{
  filters: [{ field: string, operator: string, value: any }],
  semantic_search: string | null,  // text to embed for similarity search
  sort: { field: string, direction: 'asc' | 'desc' } | null,
  limit: number
}
```

Parse and validate the response. Handle edge cases: query that's just a greeting (return null plan), ambiguous query (return best-effort plan with a note).
**⚠️ Complexity flag:** The system prompt for this LLM call needs careful design. It must know all available metadata fields, their types, and valid operators. Test with varied query styles.
**Output:** Function: `interpretQuery(query: string, chatHistory: ChatMessage[]) → Promise<QueryPlan>`

### Task 13 — Query executor (filter + vector search)

**Read:** `plan/architecture.md` §Two-Stage Retrieval
**Do:** Create a query execution module that takes a `QueryPlan` and `rollId`, executes it against Supabase:

1. Build SQL WHERE clauses from `filters` (operating on `image_metadata.metadata` JSONB)
2. If `semantic_search` is present: embed the text (Task 8's `embedText`), run pgvector cosine similarity query on `image_embeddings`
3. Combine: if both filters and semantic search, intersect results and sort by similarity score
4. Apply sort and limit
5. Return array of Image objects with their metadata

**Output:** Function: `executeQuery(plan: QueryPlan, rollId: string) → Promise<QueryResult>`

### Task 14 — Image-as-prompt search

**Read:** `plan/architecture.md` §Image-as-Prompt variant
**Do:** Create a function that takes an array of image IDs (the references) + optional text query + rollId:

1. Fetch stored embeddings for the reference images
2. Compute centroid (element-wise average)
3. If text query provided: embed it, blend with centroid (weighted average, e.g., 0.7 centroid + 0.3 text)
4. Run pgvector nearest-neighbor search using the blended vector
5. Exclude the reference images from results
6. Return ranked results

**Output:** Function: `searchByImageReferences(imageIds: string[], rollId: string, textQuery?: string) → Promise<Image[]>`

### Task 15 — Chat Server Action ✅

**Do:** Create `actions/chat.ts` with a `sendMessage` Server Action:

1. Accepts rollId + message text + optional reference image IDs
2. Saves user message to `chat_messages`
3. Fetches chat history (last 20 messages for context)
4. If reference images provided: calls Task 14 (image-as-prompt search)
5. Else: calls Task 12 (interpret query) → Task 13 (execute query)
6. Saves assistant response to `chat_messages` with `result_image_ids` and `interpreted_filter`
7. Returns the response + result images

Create `getChatHistory` action to load paginated chat for a roll.
**Output:** Full chat-to-results pipeline works.

---

## Phase 4: Galleries ✅

### Task 16 — Gallery CRUD

**Do:** Create `actions/galleries.ts` with Server Actions:

- `createGallery(rollId, name, imageIds, filterCriteria?, layoutOptions?)` — creates gallery + gallery_images rows, auto-generates slug from name
- `updateGallery(galleryId, updates)` — update name, layouts, visibility
- `addImagesToGallery(galleryId, imageIds)` — append images
- `removeImagesFromGallery(galleryId, imageIds)`
- `reorderGalleryImages(galleryId, orderedImageIds)`
- `listGalleries(rollId?)` — list user's galleries, optionally filtered by roll
- `getPublicGallery(slug)` — fetch gallery + images for public view (no auth required, checks is_public)

Slug generation: kebab-case from name, append short random suffix if collision.
**Output:** Gallery operations work end-to-end.

---

## Phase 5: Frontend

> **Read `plan/frontend.md` before starting any task in this phase.** It contains the full design system (colors, typography, spacing, motion), screen specifications, selection flow, dimming behavior, preview panel, suggestions, stream of thought, actionable filters, and public gallery layout modes.

### Task 17 — App layout shell + The Rail

**Read:** `plan/frontend.md`
**Do:** Build the authenticated app layout `(app)/layout.tsx` with The Rail — a sidebar that is not a traditional menu but a portal to Rolls. It sits silently on the left, flush with the canvas, `text-lg` typography. Roll names listed directly. Hovering a Roll name shows a micro-preview: a 2×2 grid of mini thumbnails (`.animate-bloom` on appear) giving a glimpse of the roll before clicking. User avatar at bottom with logout. Content area fills the rest of the viewport on white background.
**Output:** Navigable app shell with Rail matching frontend.md spec.

### Task 18 — Roll list + create

**Read:** `plan/frontend.md`
**Do:** Build Dashboard page (`/`) showing user's rolls as cards with 2×2 thumbnail mosaics. Each roll shows name, image count, indexing progress. "New Roll" button with name/description input. Stats row at top (total rolls, images, indexed). Calls `createRoll` Server Action.
**Output:** Can create and browse rolls.

### Task 19 — Upload (ambient drag-and-drop)

**Read:** `plan/frontend.md`
**Do:** No dedicated upload page. Instead, implement drag-and-drop upload on the Roll View. Dragging files over the image grid or chat area triggers an upload overlay with crisp typography: "Drop to index." On drop, files upload to ImageKit and indexing begins via Inngest. Progress shown as a monospaced readout (`Uploading & Indexing 14 of 42...` in `text-base font-mono`) that sits unobtrusively near the chat. Already-indexed images appear in the grid immediately — the user can start chatting while background processing continues. Subscribe to Supabase Realtime on `images` table filtered by rollId to update statuses.
**⚠️ Complexity flag:** Realtime subscription for progress tracking needs careful cleanup on unmount. Batch UI updates to avoid re-rendering per image.
**Output:** Frictionless upload + progress within the roll view.

### Task 20 — The Command Center (chat + grid + selection + dimming)

**Read:** `plan/frontend.md` §The Command Center
**Do:** Build `/rolls/[rollId]` page — the core of the app. Two symbiotic entities in a vertical stack: the Chat (engine, top) and the Grid (output, bottom).

**The Chat (top):**

- The input box is the hero element — a single, centered, punctually-rounded (`rounded-2xl`) field resting prominently at the top of the page. It drives everything below. This is not a sidebar or a secondary panel — it is the primary interface.
- Chat history flows above the input (or collapses upward). Clean, large typography — `text-lg` minimum, never smaller. Messages: user messages and assistant responses in a simple top-to-bottom conversational flow.
- Sends messages via `sendMessage` Server Action. Each assistant response that returned results shows the image count and the interpreted filter (collapsed by default, toggleable).
- **Selection strip:** The moment the first image is selected in the grid, a strip appears *inside* the chat input area, directly above the text field, using `.animate-bloom`. The strip contains:
  - Small square thumbnails of selected images (`w-5 h-5`, `rounded-none`, sharp edges matching the grid aesthetic), scrollable horizontally. Each thumbnail has a small × to deselect on hover.
  - A count line directly beneath the thumbnails, above the text input: `"16 selected"` in `text-base font-mono`.
  - When no images are selected, the strip is completely invisible. The input returns to its default state.

**The Grid (bottom):**

- Fluid masonry layout flowing strictly beneath the chat. Images are edge-to-edge relative to their cells, `gap-1`. Loaded via ImageKit URLs with thumbnail transforms.
- **Click** any image = toggle selection. No mode switch, no button, no menu. Selection is always available. Selected images show `ring-2 ring-semantic-info ring-offset-2`.
- **Hover** any image = reveal contextual tools (Fullscreen icon to open Image Detail) as small overlaid icons with `.animate-bloom`. Zero layout shift.

**Querying + grid response:**

- User types a text prompt alongside selections (e.g., "find 50 more with this same vibe") and sends. Both references and text submit together to the image-as-prompt pipeline.
- The grid responds with three-tier opacity:
  - **Result images:** Full `opacity-100`.
  - **Reference images (user's selections):** Keep `ring-2 ring-semantic-info` at full opacity — visually distinct as "input."
  - **All other images:** Dim to `opacity-15`. Ghosts — present for spatial memory, but the eye skips them. No reflow. No disappearing. No layout shift.
- **Result count** appears near the chat: `"50 results from 1,000"` in `text-base font-mono`.
- The user can refine with follow-up messages ("narrow to 20", "exclude the ones with people"). The grid updates — some bright images dim, others emerge. The conversation builds on itself, each refinement sharpening the selection.
- **Clearing:** Typing "show all" in chat, or a small ghost-style reset button near the result count, restores all images to `opacity-100` and clears all selections. Full roll restored.

**⚠️ Complexity flag:** This is the most complex UI surface. Build in sub-steps:

1. Chat input as hero element + basic message send/receive
2. Static image grid with masonry layout
3. Wire chat → grid (query results update the grid)
4. Click-to-select + selection strip in chat input with count
5. Three-tier dimming behavior on query results

**Output:** Core app experience works — chat drives grid, frictionless selection, dimming preserves spatial memory.

### Task 21 — Preview panel + gallery creation

**Read:** `plan/frontend.md` §Preview Panel (The Narrative Check)
**Do:** Build the slide-up preview panel and integrate gallery creation into it.

**Preview panel:**
- A panel rises from the bottom of the viewport (~60% height). The main grid stays behind it, visible through the backdrop (`bg-primary-950/40`).
- **Trigger:** A "Preview selection" ghost button appears near the result count once results exist. Also accessible via keyboard shortcut (`Space` when images are selected).
- **Content:** Result images displayed in a tight masonry grid (3-4 columns, small thumbnails). Clean, dense, narrative-focused — this is where the user judges whether the set tells a story. Images populate with a subtle stagger animation.
- **Header inside panel:** Count (`"50 images"` in `text-xl font-medium`) + "Save as Gallery" button (`bg-primary-900 text-white rounded-xl`).
- **Dismiss:** Click backdrop above panel, press Escape, or drag panel down. Grid underneath is exactly where the user left it — no reflow, no state change.
- **Animation:** Panel slides up with `.animate-bloom` timing (150ms ease-out).

**Save-as-gallery flow (inside panel):**
1. Clicking "Save as Gallery" reveals inline fields — gallery name input, layout selector (masonry/timeline/grid), visibility toggle (public/private).
2. Submit calls `createGallery` Server Action with current result image IDs.
3. Panel closes. Confirmation appears in the chat: `"Gallery saved → /g/[slug]"` with clickable link.
4. Gallery is accessible from the Gallery Manager and (if public) via the public URL.

**Output:** Preview panel for narrative judgment + gallery creation flows naturally from the curation experience.

### Task 22 — Stream of thought (processing indicator)

**Read:** `plan/frontend.md` §Stream of Thought
**Do:** When a query is processing, show a temporary assistant message in the chat with mono-font processing lines that appear sequentially.

1. Create a `ProcessingIndicator` component. Renders `text-base font-mono text-primary-200` lines.
2. Lines appear one by one with `.animate-bloom` and staggered delay (100ms between lines):
   - Text query: `Interpreting query...` → `Searching N images...` → `Found M matches`
   - Image-as-prompt: `Computing visual similarity...` → `Blending with text prompt...` → `Found M matches`
3. The processing message occupies the same position the real response will take. When results arrive, processing fades out and the real response blooms in — no layout shift.
4. Wire into the `sendMessage` flow: show processing immediately on send, replace when response arrives.

**Output:** User always knows the system is working. Feels precise, not generic.

### Task 23 — Roll suggestions backend

**Do:** Backend support for contextual starter suggestions on each roll.

1. Run this SQL in Supabase SQL editor: `ALTER TABLE rolls ADD COLUMN suggestions jsonb;`
2. Create a `generateRollSuggestions` utility in `lib/suggestions.ts` that runs SQL aggregations on `image_metadata` for a roll: count by `scene.setting`, `people.count` ranges, top tags, `quality_score` distribution, `time_of_day` spread. From these stats, generate 3-4 natural-language starter suggestions. This is template-based, not an LLM call.
3. Create an Inngest function `generate-roll-suggestions` triggered by `indexing/complete.roll` event (fire this event at the end of `index-roll` fan-out when all images are indexed). Writes suggestions to `rolls.suggestions`.
4. On re-index, regenerate suggestions.

**Output:** Every indexed roll has contextual starter suggestions stored in the DB.

### Task 24 — Suggestions + follow-ups frontend

**Read:** `plan/frontend.md` §Suggestions, §Follow-up suggestions
**Do:** Two UI features that make the chat feel like a collaborator.

**Initial suggestions:**
- When no conversation exists, render suggestions from `rolls.suggestions` as ghost-style pill chips beneath the chat input (`rounded-xl`, `text-base`, `border border-primary-200`, `hover:bg-primary-100`), laid out horizontally, centered. Clicking auto-sends the suggestion as a message.
- Before indexing completes (or if `suggestions` is null), show static universal starters: `"Show me the best shots"`, `"Find all portraits"`, `"What's in this roll?"`.

**Follow-up suggestions:**
1. Extend the query interpreter prompt in `lib/gemini/query.ts` — add to the system prompt: "Also return `suggested_followups`: an array of 2-3 short natural-language follow-up queries the user might want to try next, based on the current result set. Reference specific aspects of the results."
2. Parse `suggested_followups` from the LLM response alongside the query plan.
3. Return follow-ups as part of the `sendMessage` response. Store in the existing `interpreted_filter` JSONB as an additional `followups` key.
4. Render follow-up chips beneath each assistant message that has results. Same pill styling as initial suggestions. Clicking sends as next message.

**Output:** Chat never feels cold. User always has a next step.

### Task 25 — Actionable interpreted filters

**Read:** `plan/frontend.md` §Actionable Interpreted Filters
**Do:** Transform the collapsed interpreted filter from a diagnostic readout into a direct manipulation tool.

1. Parse `interpreted_filter` JSONB from the assistant message into individual filter conditions.
2. Render each condition as an editable chip: `text-base font-mono`, `bg-primary-100 rounded-lg px-3 py-1`. Examples: `scene: outdoor`, `blur_score < 0.3`, `tags: portrait`.
3. Each chip has a × button on hover. Clicking × removes that filter and re-runs the query automatically.
4. A small `+` button at the end of the chip row opens an inline input for adding a filter condition manually.
5. Grid updates live as filters are added/removed — same dimming behavior as a new chat query.
6. Create a `rerunWithModifiedFilters` function in `actions/chat.ts` that takes an existing `QueryPlan`, applies modifications, and calls `executeQuery` directly (bypassing the NL interpreter).

**Output:** Users can start with natural language and fine-tune with direct manipulation.

### Task 26 — Image Detail (The Darkroom)

**Read:** `plan/frontend.md` §Image Detail
**Do:** Build the full-screen image detail overlay.

- Full-screen overlay. Background is pure black (`primary-950`) or pure white, isolating the image completely.
- Image commands maximum viewport space, maintaining exact aspect ratio.
- Hidden UI: hover near edges to reveal next/prev arrows, hover bottom to summon technical details (mono font typography showing dimensions, index data, tags, quality score).
- Arrow key navigation through current result set. Escape to close. Click backdrop to close.

**Output:** Immersive single-image view with hidden metadata.

### Task 27 — Gallery management

**Read:** `plan/frontend.md`
**Do:** Gallery management is surfaced via a full-height drawer from the right (or via natural language in chat: "show my galleries"). The drawer lists user's galleries: name, image count, public/private badge, link to public URL if public. Click into a gallery within the drawer to see its images with reorder (drag and drop) and remove capabilities. Edit name, layout, visibility. If a dedicated `/galleries` route is needed for direct navigation, it can exist as a simple page that opens the same drawer.
**Output:** Full gallery management.

### Task 28 — Public gallery page

**Read:** `plan/frontend.md` §Public Gallery
**Do:** Build `/g/[slug]` page (no auth required, no Rail). Fetches gallery via `getPublicGallery`. Minimalist top bar: logo (top-left), gallery name `text-xl font-medium` (center), view mode toggle icons (top-right, if owner enabled multiple layouts).

**View modes:**

- **Masonry:** Fluid columns, vertical scroll. Native aspect ratios, `gap-1`.
- **Timeline:** On large screens, a horizontal scroll track — images side-by-side, aligned on central X-axis, each max `w-1/4` of viewport, native aspect ratios. On mobile, folds to a single-column vertical stack.
- **Mobile (all modes):** Full-width single-column stack.
- Transitions between modes should be smooth (View Transitions API or Framer Motion) — no jarring layout jumps.

Images served via ImageKit with responsive transforms and srcset. If gallery not found or not public, show 404.
**Output:** Shareable public gallery works.

---

## Phase 6: Polish

### Task 29 — Error handling + edge cases

**Do:** Audit all Server Actions and Inngest functions for error handling:

- Upload fails mid-batch (partial success: images already uploaded are kept, user notified of failures)
- Gemini rate limit hit (Inngest retry with backoff)
- Embedding call fails (image marked failed, can be retried)
- Chat query returns zero results (assistant says so, suggests broadening query via follow-up suggestions)
- Empty roll (chat explains no images to search, shows upload prompt)
- Image deleted while gallery references it (handle gracefully in gallery view)
**Output:** No unhandled error states.

### Task 30 — Indexing status + retry mechanism

**Do:** On the roll detail page, show indexing status summary (X indexed, Y pending, Z failed) in `text-base font-mono` near the chat. For failed images, provide a "Retry" button that re-sends `indexing/process.image` events for failed images. Update status back to `pending` on retry.
**Output:** Users can recover from indexing failures.

### Task 31 — Performance optimization

**Do:** Add thumbnail transforms to all grid/masonry views (e.g., w-400, q-80). Add pagination or infinite scroll to image grids (don't load 1000 images at once). Add `loading.tsx` skeletons for roll and gallery pages. Ensure vector search uses the HNSW index (verify with `EXPLAIN ANALYZE`).
**Output:** App feels fast at 1000-image scale.

---

## Phase 7: Future Features (post-MVP)

### Task 32 — Narrative curation mode

**Concept:** Instead of "find images matching X," the user says "create a sad story from my images" or "build a joyful narrative using my outdoor shots." The system doesn't just retrieve — it curates and sequences images into a coherent visual narrative with an emotional arc.

**Architecture fit:** This is a text-only LLM call on stored metadata — no vision calls at query time. Fully compatible with ADR-005.

**Implementation:**

1. **Query interpreter extension:** Add `mode: 'search' | 'narrative'` and `narrative_mood: string | null` to the `QueryPlan` type. The query interpreter detects narrative intent from messages like "create a story," "build a narrative," "arrange these into a sequence" and sets `mode: 'narrative'` with the extracted mood.

2. **Candidate retrieval:** Same as current search — use filters + semantic search to build a candidate pool (50-100 images). If the user provides reference images or explicit filters ("a sad narrative from my outdoor shots"), apply those to narrow the pool. If no filters, use the full roll.

3. **Narrative sequencing (new LLM call):** Send the candidates' metadata (descriptions, moods, tags, quality scores, composition) to Gemini Flash with a narrative prompt:
   ```
   You are a photo editor creating a visual narrative. From these candidate images,
   select 15-25 and order them to tell a [MOOD] story.
   
   Consider: emotional arc (opening, build, climax, resolution), visual flow
   (color progression, compositional variety, scale shifts), and pacing
   (don't cluster similar images together).
   
   Return a JSON array:
   [{ "image_id": "...", "position": 1, "reason": "Opens with a quiet, solitary scene" }]
   ```
   This is one Gemini Flash call reading ~50-80 descriptions. Cost: ~$0.001.

4. **Response format:** The assistant message includes the narrative reasoning. Each image in the result set has a `position` and `reason`. The grid displays images in narrative order (not similarity rank). The preview panel becomes especially important here — it shows the sequence as a story.

5. **Gallery save:** When saving a narrative as a gallery, the ordering is preserved in `gallery_images.position`. The public gallery's timeline view becomes the natural display mode for narratives.

**No schema changes required.** The existing `QueryPlan`, `chat_messages`, `gallery_images.position`, and public gallery timeline layout all support this without modification. The only new code is: (a) narrative intent detection in the query interpreter, (b) a new `curateNarrative()` function in `lib/gemini/`, (c) routing in the chat action to call it when `mode === 'narrative'`.

**Output:** Users can create sequenced visual stories from their image collections through natural language.