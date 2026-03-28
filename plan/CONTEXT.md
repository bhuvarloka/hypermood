# CONTEXT.md — Hypermood Project Overview

> Paste this file (or reference it) at the start of any new chat session. It captures the full project state. All detailed specs live in the `plan/` directory files listed below.

## What is Hypermood

A Next.js web application for semantic image intelligence — a private, AI-powered layer over personal image collections. Users upload batches of images ("rolls"), the system indexes every image once in the background (extracting rich structured metadata + vector embeddings), and all subsequent interaction happens through a conversational chat interface that filters, searches, and curates images using natural language. The core principle: **index once, query forever** — no vision model calls at query time.

**Domain:** hypermood.pro

## Core Workflow

1. User uploads images to a roll → images stored on ImageKit → Inngest background jobs call Gemini Flash-Lite (vision) for metadata extraction + Gemini Embedding 2 for vector embeddings → stored in Supabase (Postgres + pgvector)
2. User queries via chat → Gemini Flash interprets NL → structured filter + vector search on stored metadata/embeddings → grid updates with results (three-tier opacity dimming)
3. User can select reference images + text prompt (image-as-prompt) → centroid of embeddings blended with text → similarity search
4. User previews curated set in slide-up panel → saves as public gallery

## Tech Stack (key decisions)

- **Next.js 16** (App Router, Server Actions)
- **Supabase** (Postgres, Auth OTP, RLS, pgvector, Realtime)
- **Google Gemini**: `gemini-3.1-flash-lite-preview` (vision indexing), `gemini-3-flash-preview` (query interpretation), `gemini-embedding-2-preview` (multimodal embeddings, 3072 dim)
- **Inngest v4** (background job orchestration)
- **ImageKit** (storage, CDN, URL-based transforms)
- **Tailwind CSS v4** (hand-built components, no shadcn/ui, no component library)
- **TypeScript** strict throughout

## Design Philosophy

Swiss-minimal. Warm zinc grayscale. The images and chat are kings — everything else disappears. Login is the one dark screen (`primary-950`). The app is sharp (`rounded-none` on images), with punctual softness on floating chat elements (`rounded-2xl`). Typography: Dyatype Sans + Neue Montreal Mono. Body text is never smaller than `text-lg`. No drop shadows. No muted text — hierarchy through size and weight only.

## Architecture Highlights

- **Multi-tenant from day one** — all tables have `user_id` + RLS
- **No vision calls at query time** — queries only touch metadata DB + embeddings
- **Two-stage retrieval** — vector search returns top K, then LLM reranks using metadata
- **Single multimodal embedding space** — Gemini Embedding 2 maps both images and text into the same vector space (image-as-prompt works via cosine similarity)
- **Storage abstraction** — DB stores canonical keys, URLs resolved at render time via one utility function

## Plan Directory (source of truth)

| File                   | Contents                                                                                                                                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan/architecture.md` | Three-phase pipeline, two-stage retrieval, indexing schema, suggestion generation, storage abstraction, chat persistence, all ADRs                                                                                                                                            |
| `plan/stack.md`        | Full tech stack table, SDK list, gotchas for every technology                                                                                                                                                                                                                 |
| `plan/setup.md`        | Step-by-step manual setup (Supabase, Auth, Google AI, ImageKit, Inngest, env vars, verification)                                                                                                                                                                              |
| `plan/frontend.md`     | Complete design system (colors, typography, spacing, motion), all screen specs (Rail, Command Center, Upload, Image Detail, Settings, Public Gallery, Login), selection flow, dimming behavior, preview panel, suggestions, follow-ups, stream of thought, actionable filters |
| `plan/tasks.md`        | All implementation tasks. Tasks 1–18 complete. Tasks 19–30 are remaining frontend + UX patterns. Tasks 31–33 are polish. Task 34 is future narrative curation.                                                                                                                |
| `plan/prompt.md`       | The vision indexing prompt (Task 7) — system prompt, user prompt, generation config                                                                                                                                                                                           |
| `plan/structure.md`    | Folder layout, naming conventions, code style rules, anti-patterns                                                                                                                                                                                                            |
| `plan/dev.md`          | Dev setup commands, running locally, build, lint, type check                                                                                                                                                                                                                  |
| `plan/glossary.md`     | Domain terminology definitions                                                                                                                                                                                                                                                |
| `plan/testing.md`      | Testing strategy, what to test, what not to test, Vitest setup                                                                                                                                                                                                                |

## Current Progress

**Tasks 1–16: COMPLETE** — Project scaffold, DB schema + RLS (with explicit Postgres GRANTs for `anon`/`authenticated` roles), Supabase clients, Auth OTP, ImageKit upload, EXIF extraction, Gemini vision indexing, Gemini embeddings, Inngest pipeline (index-image + index-roll fan-out), upload Server Action, query interpreter, query executor, image-as-prompt search, chat Server Action, gallery CRUD.

**Tasks 17–20: COMPLETE** — Design system (Tailwind v4 `@theme`, fonts, `.animate-bloom`, `.animate-swiss`). Login page: dark void (`bg-primary-950`), two-step OTP flow with a segmented 6-box digit input (`OtpBoxes` component) — paste-aware, auto-advances, auto-submits on completion, border error state. Next.js 16 route protection via `proxy.ts` (not middleware). App layout shell: `flex h-screen`, flush Rail (`w-56`, no border/shadow), micro-preview on hover (`.animate-bloom`, 2×2 grid, `pl-2` gap in hover zone). Roll list: full-width rows with `hover:bg-primary-50`, 2×2 thumbnail mosaic, `text-3xl font-medium` name, mono stats. Inline "New Roll" creation with `.animate-bloom` expand.

**Tasks 21–25: COMPLETE** — Ambient drag-and-drop upload (`AmbientUpload` wraps the roll view, Supabase Realtime subscription populates grid live, batched via `requestAnimationFrame`). Command Center (`/rolls/[rollId]`): chat input as hero, masonry image grid, three-tier opacity dimming on query results, click-to-select with `.animate-bloom` selection strip, `Show all` reset. Stream of thought (`ProcessingIndicator`). Roll suggestions backend (template-based, stored in `rolls.suggestions` jsonb, generated by Inngest `generate-roll-suggestions` on `indexing/complete.roll`). Suggestions + follow-ups frontend: initial chips from `rolls.suggestions` (fallback to universal starters), follow-up chips after each assistant message with results, `followups: string[]` field in `QueryPlan`, `historyLoaded` flag prevents flash on mount.

**Task 26: COMPLETE** — Actionable interpreted filters: filter chips rendered per filter condition, removable on ×-click with auto-rerun, inline + input to add new filters, `rerunWithModifiedFilters` bypasses NL interpreter.

**Task 27: COMPLETE** — Image Detail (The Darkroom): full-screen overlay with dark/light toggle, context-aware prev/next navigation (result set scoped), edge-hover arrows, bottom-hover metadata panel (filename, dimensions, captured date, quality score, scene, tags via `getImageMetadata` server action), keyboard nav (←/→/Escape).

**Task 28: COMPLETE** — Preview panel + gallery creation: `PreviewPanel` component slides up from bottom (60vh, `.animate-bloom`, drag-to-dismiss). Triggered by "Preview selection" ghost button (appears when results exist) or `Space` when focus is on body. Shows result/selected/all images in 3-4 column masonry with 30ms stagger. Inline save form (gallery name, layout toggle masonry/timeline, public/private toggle) calls `createGallery` Server Action. On save: panel closes, confirmation assistant message `"Gallery saved → /g/[slug]"` appears in chat as clickable link.

**Task 29: COMPLETE** — Gallery management drawer: `GalleryDrawer` component slides in from the right. List view shows gallery rows (name, image count, public/private badge in `font-mono`, `hover:bg-primary-50`). Detail view: 3-col compact image grid, drag-to-reorder, `×` to remove, inline name/layout/visibility editing. Accessible from Rail "Galleries" button, from chat (`GALLERY_INTENT_RE` dispatches `hypermood:open-galleries` event), and via `/galleries` + `/galleries/[galleryId]` direct routes. Server actions: `getGalleryImages`, `listGalleriesWithImageData`.

**Task 30: COMPLETE** — Public gallery page `/g/[slug]`: `PublicGalleryView` client component, no auth, no Rail. Top bar: logo (left), gallery name (center), view mode toggle (right — shown only for `layout === 'timeline'` galleries). Masonry: `columns-1..4`, `gap-16` editorial spacing, `mb-16` between items. Timeline: horizontal scroll strip on `md+` (`flex-row overflow-x-auto`, `lg:w-1/4` per image, `gap-2`), folds to full-width vertical stack on mobile. Mode switch uses `document.startViewTransition` (with sync fallback) + `viewTransitionName` per image for smooth glide animation. Images stagger-bloom in (30ms, capped 600ms). 404 via `notFound()` on private/missing galleries. Old `src/app/gallery/[slug]/page.tsx` stub removed.

## Key UX Patterns (from Shape of AI analysis)

These are integrated into `frontend.md` and `tasks.md`:

1. **Suggestions** — contextual starter chips (generated from roll metadata stats) + follow-up chips after each query result
2. **Stream of Thought** — mono-font processing indicator showing query stages in real-time
3. **Actionable Interpreted Filters** — clickable/removable/addable filter chips for direct manipulation after NL query
4. **Selection flow** — click to select (no mode toggle), selection strip in chat input, three-tier dimming on results
5. **Preview panel** — slide-up panel for narrative judgment, gallery save integrated

## Key Interaction: Image-as-Prompt

Click images in grid → thumbnails appear in chat input strip with count → type text prompt → system averages selected image embeddings into centroid, blends with text embedding (0.7/0.3 weight) → pgvector nearest-neighbor search → results displayed with dimming. No vision calls — pure embedding math.

## Future Features (documented, not built)

- **Task 34: Narrative curation** — "create a sad story from my images" — LLM sequences selected images into a narrative arc using stored descriptions
- **Domain layers** — specialized metadata extraction for specific use cases (scientific, fashion)
- **Telegram/QR upload** — external contributors uploading to shared rolls
- **Pluggable models** — swap vision/embedding models per roll

## Working With This Codebase

- Read `plan/tasks.md` for what to build next
- Read `plan/frontend.md` before any frontend task
- Read `plan/architecture.md` for backend context
- All Gemini model strings are in env vars — if a model is renamed, update `.env.local` and check `plan/stack.md` gotchas
- Never store full URLs in DB — use `getImageUrl()` from `lib/imagekit/url.ts`
- Never call vision models at query time
- Every table has RLS — use the admin client only in Inngest jobs
