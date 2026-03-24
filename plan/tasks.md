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

### Task 4 — Auth (OTP login + route protection)

**Read:** `plan/stack.md` (Supabase Auth gotchas)
**Do:** Create a minimal login page at `(auth)/login/page.tsx` with email OTP input. After successful OTP verification, redirect to `/rolls`. Protect `/(app)/*` routes by calling `supabase.auth.getUser()` in the layout Server Component — return `unauthorized()` if no session. No middleware/proxy. No styling needed yet — functional only.
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

> **`plan/frontend.md` is the source of truth for every visual and interaction decision in this phase.** Read it in full before starting any task. Tasks below are derived from it — if there is ever a conflict, `frontend.md` wins.

### Task 17 — Design system foundation ✅

**Read:** `plan/frontend.md` §Design System
**Do:** Wire up the full design system before any screen is built. Everything downstream depends on this being correct.

**Tailwind config (`tailwind.config.ts`):**
- Extend `colors` with the exact `primary` and `semantic` palettes from `frontend.md` (warm zinc scale: 50, 100, 200, 800, 900, 950; semantic info/success/alert).
- Extend `fontFamily`: `sans` → `["Dyatype Sans", "Helvetica Neue", "system-ui", "sans-serif"]`, `mono` → `["Neue Montreal Mono", "monospace"]`.
- Default `borderRadius` must NOT be overridden globally — `rounded-none` is the app default; curves appear only where the spec calls for them (`rounded-xl`, `rounded-2xl`).

**`globals.css`:**
- Define `.animate-bloom`: `opacity-0 scale-95` → `opacity-100 scale-100`, `150ms ease-out`. Used for all generative UI elements appearing in chat, the selection strip, hover overlays on the grid, and the preview panel.
- Define `.animate-swiss`: `transition-all duration-200 ease-out`. Used for standard hover micro-interactions (Rail roll names, button hovers, row states). No bouncy easing anywhere.
- Custom CSS for masonry layout (CSS `columns` or `grid` with `auto` rows — whichever avoids JS for the internal grid at this scale).
- Set `focus:ring-2 focus:ring-primary-900` as the app-wide keyboard focus ring. No browser defaults.

**Typographic discipline (enforce at this step, not component by component):**
- `text-lg` is the minimum body size. Nothing smaller appears in the authenticated app.
- Hierarchy comes from size and weight, never from muting color to gray.
- Monospace (`font-mono`) is used exclusively for technical readouts: timestamps, counts, scores, tags, status lines, processing indicators.

**Output:** `pnpm dev` shows no visual regressions. Tailwind palette, fonts, animation utilities, and focus rings are available globally. Confirmed by visually checking a test page with each color, font, and animation class.

### Task 18 — Login page (The Dark Void) ✅

**Read:** `plan/frontend.md` §Login
**Do:** Build `(auth)/login/page.tsx` with full design fidelity — this is the threshold, the only fully dark screen.

- Full viewport, `bg-primary-950`. No other background.
- `"Hypermood"` in `text-5xl tracking-tight text-white font-sans`. Centered.
- A single email input. A single submit button. No labels, no supporting copy, no decorative elements. Absolute silence.
- Input and button: `rounded-none` (sharp, like everything else). White text on dark. Focus ring: `focus:ring-2 focus:ring-white` (inverted from app default because background is dark).
- OTP code step: 6 individual digit boxes (`w-12 h-14 bg-primary-900`, `border-primary-800`). Paste-aware — paste a code fills all 6 boxes and auto-submits instantly. Typing auto-advances focus. Backspace retreats. Auto-submits when all 6 digits are filled (no submit button on code step). Error state turns all borders `border-semantic-alert`. Focus transitions to `border-white`. The step shows `"Code sent to [email]"` in `text-base font-mono text-primary-200`. A ghost `"Use a different email"` link resets to the email step.
- After successful verification, redirect to `/rolls`.

**Output:** Login screen matches the dark void spec. Functional OTP auth with segmented digit input. No light backgrounds, no shadows, no decorative chrome.

### Task 19 — App layout shell + The Rail ✅

**Read:** `plan/frontend.md` §The Rail
**Do:** Build the authenticated app layout `(app)/layout.tsx` with The Rail.

**The Rail is not a menu. It is a portal.**
- Sits silently on the left, flush with the canvas. No border, no shadow, no panel background that differs from the page — it blends into the white canvas.
- Roll names listed directly in `text-lg`. No icons, no category headers, no indentation hierarchy.
- **Hover micro-preview:** Hovering a Roll name triggers a 2×2 grid of mini thumbnails that appears with `.animate-bloom`. This is a glimpse, not a tooltip — it feels like the roll breathing. Use ImageKit thumbnail transforms for the 4 thumbnails. The micro-preview disappears instantly on mouse-leave (no delay).
- The hover state itself on the roll name uses `.animate-swiss` — a subtle `bg-primary-100` shift (per design system: `primary-100` is for button/row hover states), nothing more.
- User avatar at the bottom with logout. Monospace email or name label, `text-base font-mono`.
- Content area fills the remaining viewport on pure white (`bg-white`). No inner padding on the layout shell — each page controls its own spacing.

**Output:** Navigable app shell. Rail is visually invisible as a "menu." Micro-preview blooms on hover. Keyboard focus navigable through roll list.

### Task 20 — Roll list + create ✅

**Read:** `plan/frontend.md`
**Do:** Build the `/rolls` dashboard page.

- Roll rows, not cards. No `border`, no `rounded`, no `shadow`. Each roll occupies a full-width row with a `hover:bg-primary-50` shift (`.animate-swiss`). Depth through background, never borders.
- Each row: 2×2 thumbnail mosaic (ImageKit transforms, `rounded-none`, `gap-1`) on the left. Roll name in `text-3xl font-medium` beside it. Image count and indexing progress in `text-base font-mono` below the name (e.g., `"142 images · 138 indexed"`).
- Stats row at the very top of the page: total rolls, total images, total indexed — all in `text-base font-mono`. No labels boxed or badged — plain mono text.
- **"New Roll" creation:** An inline reveal — no modal, no route change. Clicking "New Roll" (a ghost-style button, `text-base font-medium`, no fill — ghost here means no background fill; a subtle `border border-primary-200` is acceptable) expands an inline input field with `rounded-none` sharp edges directly in the list. Press Enter or blur to confirm. Calls `createRoll` Server Action. On success, call `router.refresh()` and collapse the form — the list re-renders with the new roll in place. The new roll appears with `.animate-bloom`.
- No muted text anywhere. If something is secondary, make it smaller or mono — not gray.

**Output:** Can create and browse rolls. Zero boxed cards. Inline creation works. Indexing progress visible in mono font.

### Task 21 — Upload (ambient drag-and-drop)

**Read:** `plan/frontend.md` §Upload
**Do:** No dedicated upload page. Drag-and-drop is ambient — it lives on the Roll View (Task 22), not a separate route.

- Dragging files anywhere over the image grid or chat area activates the upload state. Overlay reads `"Drop to index."` in `text-3xl font-medium` — crisp, typographic, not a spinner or icon. `rounded-none`. The overlay is a semi-transparent layer over the existing content, not a full viewport takeover.
- On drop: files upload to ImageKit (calls `uploadImages` Server Action from Task 11). Indexing starts via Inngest automatically.
- Progress readout appears unobtrusively near the chat — not a modal, not a toast. A single line: `"Uploading & Indexing 14 of 42..."` in `text-base font-mono`. It updates in place as progress advances.
- Already-indexed images appear in the grid immediately as they complete. The user can start chatting with the indexed subset while the rest processes in the background.
- Subscribe to Supabase Realtime on `images` where `roll_id = rollId`. On status change to `indexed`, add the image to the grid without full re-render. Batch state updates — do not trigger a re-render per individual image.
- On unmount, explicitly unsubscribe from the Realtime channel.

**⚠️ Complexity flag:** Realtime subscription cleanup is critical. Batch grid updates by collecting status changes in a buffer and flushing on `requestAnimationFrame` or a short debounce (50ms).

**Output:** Frictionless upload. Progress in mono. Grid populates live. Realtime subscription cleans up correctly.

### Task 22 — The Command Center (chat + grid + selection + dimming)

**Read:** `plan/frontend.md` §The Command Center, §Image-as-Prompt Selection Flow
**Do:** Build `/rolls/[rollId]` — the core of the app. Two symbiotic entities in a strict vertical stack: Chat (top), Grid (bottom). Build in the sub-steps listed below.

**Sub-step 1 — Chat input as hero + message flow:**
- The input is a single `rounded-2xl` field, centered, prominent. It is not a sidebar element — it is the first thing the eye lands on.
- Chat history flows above the input in top-to-bottom order. `text-lg` minimum for all message text, never smaller. User messages and assistant responses are visually distinct but neither is subordinate.
- Each assistant response that returned results shows: result count in `text-base font-mono`, the interpreted filter collapsed by default (a small toggle reveals it), and follow-up suggestion chips beneath (wired in Task 25).
- Keyboard shortcut: `Enter` submits, `Shift+Enter` for newlines. Focus ring: `focus:ring-2 focus:ring-primary-900`.

**Sub-step 2 — Image grid:**
- Fluid masonry layout, CSS-only (`columns` or equivalent). `gap-1`. Images edge-to-edge within cells. `rounded-none`.
- Images loaded via ImageKit URLs with thumbnail transforms (w-400, q-80) and responsive `srcset`. Never load full-resolution images into the grid.
- Each image cell is a stable DOM node — no unmounting/remounting as grid state changes. Use CSS `opacity` transitions, never add/remove elements.

**Sub-step 3 — Wire chat → grid (query results):**
- On `sendMessage` response, the grid receives a set of `resultImageIds`.
- Three-tier opacity applied immediately (no animation delay — the state change is the feedback):
  - **Result images:** `opacity-100`
  - **Reference images (selected by user before send):** `opacity-100` + `ring-2 ring-semantic-info ring-offset-2` (they remain "input," visually distinct)
  - **All other images:** `opacity-15` — ghosts. Present for spatial memory. No reflow. No disappearing. No layout shift.
- Result count appears near the chat input: `"50 results from 1,000"` in `text-base font-mono`.
- **Clearing:** A ghost-style reset button near the result count (`"Show all"`) restores all images to `opacity-100` and clears selections. Also triggered if user types "show all" in chat.

**Sub-step 4 — Click-to-select + selection strip:**
- Clicking any image toggles selection. No mode switch. No "enter select mode" button. Selection is always active.
- Selected images: `ring-2 ring-semantic-info ring-offset-2`.
- The moment the first image is selected, a **selection strip** appears inside the chat input area, directly above the text field, using `.animate-bloom`:
  - Row of small square thumbnails (`w-5 h-5`, `rounded-none`), scrollable horizontally. Each has a `×` on hover to deselect.
  - Below thumbnails, above the text input: `"16 selected"` in `text-base font-mono`.
- When zero images are selected, the strip is invisible. The input box looks exactly as it always does — no reserved space, no empty strip.

**Sub-step 5 — Hover tools on grid images:**
- Hovering an image reveals a Fullscreen icon (opens The Darkroom, Task 27) as a small overlaid icon. Uses `.animate-bloom`. Zero layout shift — the icon is absolutely positioned over the image, not inserted into document flow.

**Accessibility:**
- All interactive grid images have `role="button"`, `tabIndex={0}`, and respond to `Enter`/`Space` for selection.
- Keyboard focus ring on grid images: `focus:ring-2 focus:ring-primary-900`.
- The chat input and selection strip are fully keyboard navigable.

**⚠️ Complexity flag — build in strict sub-step order. Do not attempt all five at once.**

**Output:** Chat drives grid. Frictionless click-to-select. Selection strip blooms in. Three-tier dimming preserves spatial memory. Keyboard navigable.

### Task 23 — Stream of thought (processing indicator)

**Read:** `plan/frontend.md` §Stream of Thought
**Do:** When a query is processing, a temporary assistant message occupies the exact position the real response will take — no layout shift when results arrive.

1. Create `components/chat/ProcessingIndicator`. Renders `text-base font-mono text-primary-200` lines. It is a full chat message bubble placeholder — same width, same position — not a floating spinner.
2. Lines appear one by one with `.animate-bloom` and 100ms staggered delay between each:
   - Text query: `"Interpreting query..."` → `"Searching N images..."` → `"Found M matches"`
   - Image-as-prompt: `"Computing visual similarity..."` → `"Blending with text prompt..."` → `"Found M matches"`
3. When the real response arrives, the `ProcessingIndicator` is replaced in-place by the assistant message — no reflow, no layout jump. The swap is instant; the new content uses `.animate-bloom` to appear.
4. Wire into `sendMessage`: insert `ProcessingIndicator` into chat state immediately on send, replace with real response on resolve.

**Output:** User always knows the system is working. Terminal-like precision. No layout shift on response arrival.

### Task 24 — Roll suggestions backend

**Do:** Backend support for contextual starter suggestions on each roll.

1. Run this SQL: `ALTER TABLE rolls ADD COLUMN suggestions jsonb;`
2. Create `lib/suggestions.ts` — `generateRollSuggestions(rollId)`. Runs SQL aggregations on `image_metadata` for the roll: count by `scene.setting`, `people.count` ranges, top tags, `quality_score` distribution, `time_of_day` spread. From these stats, produce 3-4 natural-language starter suggestions. Template-based — no LLM call.
3. Create Inngest function `generate-roll-suggestions` triggered by `indexing/complete.roll` event (fired at the end of the `index-roll` fan-out when all images are indexed). Writes suggestions to `rolls.suggestions`.
4. On re-index, regenerate suggestions.

**Output:** Every indexed roll has contextual starter suggestions stored in the DB.

### Task 25 — Suggestions + follow-ups frontend

**Read:** `plan/frontend.md` §Suggestions, §Follow-up suggestions
**Do:** Two UI features that make the chat feel like a collaborator, not a search box.

**Initial suggestions (empty chat state):**
- Render 3-4 suggestion chips beneath the chat input when no conversation exists. Ghost-style pills: `rounded-xl`, `text-base`, `border border-primary-200`, `hover:bg-primary-100` (`.animate-swiss`). Laid out horizontally, centered.
- Source: `rolls.suggestions` if indexed and populated. Fallback to universal starters (`"Show me the best shots"`, `"Find all portraits"`, `"What's in this roll?"`) if `suggestions` is null or indexing incomplete.
- Clicking a chip pre-fills and auto-submits the chat input — exactly as if the user had typed and pressed Enter.

**Follow-up suggestions (after each assistant response with results):**
1. Extend the `lib/gemini/query.ts` system prompt: ask for `suggested_followups: string[]` (2-3 items, contextual to the result set, not generic). Examples: `"Narrow to close-ups only"`, `"Exclude blurry ones"`, `"Split by time of day"`. Follow-ups must reference what just happened — they are not universal.
2. Parse `suggested_followups` from the response alongside the query plan.
3. Return follow-ups as part of `sendMessage` response payload. Store under a `followups` key in `interpreted_filter` JSONB.
4. Render follow-up chips beneath each assistant message that has results. Same pill styling. Clicking sends as next message.

**Output:** Chat never feels cold. Initial suggestions solve the blank canvas. Follow-ups keep the conversation moving.

### Task 26 — Actionable interpreted filters

**Read:** `plan/frontend.md` §Actionable Interpreted Filters
**Do:** The interpreted filter is not a debug readout — it is a direct manipulation panel. Transform it accordingly.

1. Parse `interpreted_filter` JSONB from each assistant message into discrete filter conditions.
2. Render each condition as an editable chip: `text-base font-mono`, `bg-primary-100 rounded-lg px-3 py-1`. Examples: `scene: outdoor`, `blur_score < 0.3`, `tags: portrait`. Chips sit in a row, collapsed under the assistant response toggle.
3. Each chip has a `×` button visible on hover. Clicking `×` removes that filter and re-runs the query automatically — same dimming behavior as a new chat query.
4. A `+` button at the end of the chip row opens a small inline input (not a modal) for adding a filter condition manually.
5. Add `rerunWithModifiedFilters(existingPlan: QueryPlan, modifications: FilterMod[])` to `actions/chat.ts`. It applies the modifications to the plan and calls `executeQuery` directly — bypasses the NL interpreter entirely.

**Output:** Natural language to start, surgical direct manipulation to refine. No round-trip to the LLM on filter edits.

### Task 27 — Image Detail (The Darkroom)

**Read:** `plan/frontend.md` §Image Detail
**Do:** Build the full-screen image detail overlay triggered by the Fullscreen icon on grid image hover.

- Full-screen overlay (`fixed inset-0`). Background starts as `bg-primary-950` (pure black) — the default dark isolation. A toggle in the overlay switches to pure white (`bg-white`) for images that read better on light. No gray, no semi-transparent.
- Image commands maximum viewport space at exact aspect ratio. No cropping. No letterboxing with colored bands — the background color is the letterbox.
- **Hidden UI — revealed by proximity:**
  - Hovering near left/right edges: prev/next arrows appear with `.animate-bloom`. Vanish when mouse moves to center.
  - Hovering near the bottom: technical details panel rises with `.animate-bloom`. Shows in `font-mono`: filename, dimensions (`2400 × 1600`), captured date, quality score, top tags, scene type. Vanishes on mouse-leave.
- **Navigation:** Arrow keys (`←`/`→`) navigate through the current result set (not the full roll — context-aware). `Escape` closes. Clicking the background closes.
- Roll-over behavior: reaching the end of the result set stops (no wrap-around).

**Output:** Immersive, isolated single-image view. Background isolation (dark/light toggle). Hidden metadata reveals on hover. Keyboard navigable.

### Task 28 — Preview panel + gallery creation

**Read:** `plan/frontend.md` §Preview Panel (The Narrative Check)
**Do:** Build the slide-up preview panel and the save-as-gallery flow that lives inside it.

**The panel:**
- `fixed bottom-0 inset-x-0`, height ~60vh. Slides up with `.animate-bloom` (150ms ease-out). The main grid stays behind it — visible and spatially unchanged — through the backdrop (`bg-primary-950/40`).
- **Trigger:** A ghost-style `"Preview selection"` button near the result count (appears once results exist). Also: `Space` when images are selected (keyboard shortcut).
- **Content:** Selected/result images in a tight masonry grid (3-4 columns). Small thumbnails, `rounded-none`, `gap-1`. Narrative density — this is where the user judges whether the set tells a story. Images populate with a 30ms stagger using `.animate-bloom`.
- **Header row inside panel:** Count (`"50 images"` in `text-xl font-medium`) on the left. `"Save as Gallery"` button (`bg-primary-900 text-white rounded-xl`, `text-base font-medium`) on the right.
- **Dismiss:** Click backdrop above the panel. Press `Escape`. Or drag the panel downward past a threshold. Grid is exactly where it was — no reflow, no state change.

**Save-as-gallery flow (inline inside the panel, no modal):**
1. Clicking "Save as Gallery" reveals inline fields within the panel header area: gallery name input (`rounded-none`, `text-base`), layout toggle (masonry / timeline), visibility toggle (public / private). All sharp edges matching the app default.
2. Submit calls `createGallery` Server Action.
3. Panel closes. A confirmation line appears in the chat as an assistant message: `"Gallery saved → /g/[slug]"` with the slug as a clickable link (`text-semantic-info`).

**Output:** Preview panel for narrative judgment. Save-as-gallery is one gesture from the curation result.

### Task 29 — Gallery management

**Read:** `plan/frontend.md` §Settings / Manager
**Do:** Gallery management via a full-height drawer from the right — not a separate page, not a modal.

- The drawer opens from a `"Galleries"` entry at the bottom of the Rail (or via typing `"show my galleries"` in chat on any roll — the chat action recognizes gallery management intent and triggers the drawer).
- **Drawer content:** User's galleries listed as rows (not cards). Name, image count, public/private badge in `text-base font-mono`, link to public URL if public. No borders, no shadows — rows use `hover:bg-primary-50` shift.
- **Clicking into a gallery:** Drawer content replaces with the gallery's images in a compact grid. Controls: reorder (drag and drop), remove images (`×` on hover), edit name/layout/visibility inline.
- If `/galleries` route is needed for direct navigation, it renders the same drawer as the primary content.
- All UI inside the drawer uses the same sharp-edge, mono-for-metadata, no-shadow conventions as the rest of the app.

**Output:** Full gallery management. Accessible from Rail and from natural language in chat.

### Task 30 — Public gallery page

**Read:** `plan/frontend.md` §Public Gallery
**Do:** Build `/g/[slug]` — no auth required, no Rail, pure content.

**Structure:**
- Minimal top bar: logo (`text-base font-medium`, top-left), gallery name (`text-xl font-medium`, center), view mode toggle icons (top-right, shown only if multiple layouts are enabled for this gallery).
- Fetches gallery via `getPublicGallery` action. If not found or `is_public = false`: 404 page.

**View modes (two only — masonry and timeline, matching `frontend.md`):**
- **Masonry:** Fluid columns, vertical scroll. Native aspect ratios. `gap-16` — editorial spacing, distinct from the internal grid's `gap-1`. This is the public surface; images need room.
- **Timeline:** Large screens: `flex flex-row overflow-x-auto items-center`. Images side-by-side, aligned on a central X-axis. Each image max `lg:w-1/4` viewport, native aspect ratio. `gap-1 md:gap-2`. Mobile: folds to full-width single-column vertical stack (`flex-col`).
- **Mobile (all modes):** Full-width single-column stack.

**Mode transition:** Switching between masonry and timeline must be smooth — use the View Transitions API (`document.startViewTransition`) or Framer Motion layout animations. No jarring reflow. Images glide from their masonry positions into the horizontal timeline strip.

Images served via ImageKit with responsive transforms and `srcset`. Aggressive caching headers (static at build time where possible).

**Output:** Shareable public gallery. Both layout modes work. Mode switch is smooth. 404 on private/missing.

---

## Phase 6: Polish

### Task 31 — Error handling + edge cases

**Do:** Audit all Server Actions and Inngest functions for error handling:

- Upload fails mid-batch (partial success: images already uploaded are kept, user notified of failures)
- Gemini rate limit hit (Inngest retry with backoff)
- Embedding call fails (image marked failed, can be retried)
- Chat query returns zero results (assistant says so, suggests broadening query via follow-up suggestions)
- Empty roll (chat explains no images to search, shows upload prompt)
- Image deleted while gallery references it (handle gracefully in gallery view)
**Output:** No unhandled error states.

### Task 32 — Indexing status + retry mechanism

**Do:** On the roll detail page, show indexing status summary (X indexed, Y pending, Z failed) in `text-base font-mono` near the chat. For failed images, provide a "Retry" button that re-sends `indexing/process.image` events for failed images. Update status back to `pending` on retry.
**Output:** Users can recover from indexing failures.

### Task 33 — Performance optimization

**Do:** Add thumbnail transforms to all grid/masonry views (e.g., w-400, q-80). Add pagination or infinite scroll to image grids (don't load 1000 images at once). Add `loading.tsx` skeletons for roll and gallery pages. Ensure vector search uses the HNSW index (verify with `EXPLAIN ANALYZE`).
**Output:** App feels fast at 1000-image scale.

---

## Phase 7: Future Features (post-MVP)

### Task 34 — Narrative curation mode

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