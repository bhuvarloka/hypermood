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

| File | Contents |
|---|---|
| `plan/architecture.md` | Three-phase pipeline, two-stage retrieval, indexing schema, suggestion generation, storage abstraction, chat persistence, all ADRs |
| `plan/stack.md` | Full tech stack table, SDK list, gotchas for every technology |
| `plan/setup.md` | Step-by-step manual setup (Supabase, Auth, Google AI, ImageKit, Inngest, env vars, verification) |
| `plan/frontend-v2.md` | Complete design system (colors, typography, spacing, motion), all screen specs (Rail, Command Center, Upload, Image Detail, Settings, Public Gallery, Login), selection flow, dimming behavior, preview panel, suggestions, follow-ups, stream of thought, actionable filters |
| `plan/tasks.md` | All implementation tasks (1–31 + future Task 32). Tasks 1–16 are complete. Tasks 17–31 are frontend + UX patterns. Task 32 is future narrative curation. |
| `plan/prompt.md` | The vision indexing prompt (Task 7) — system prompt, user prompt, generation config |
| `plan/structure.md` | Folder layout, naming conventions, code style rules, anti-patterns |
| `plan/dev.md` | Dev setup commands, running locally, build, lint, type check |
| `plan/glossary.md` | Domain terminology definitions |
| `plan/testing.md` | Testing strategy, what to test, what not to test, Vitest setup |

## Current Progress

**Tasks 1–16: COMPLETE** — Project scaffold, DB schema + RLS, Supabase clients, Auth OTP, ImageKit upload, EXIF extraction, Gemini vision indexing, Gemini embeddings, Inngest pipeline (index-image + index-roll fan-out), upload Server Action, query interpreter, query executor, image-as-prompt search, chat Server Action, gallery CRUD.

**Tasks 17–31: NOT STARTED** — All frontend. Starting with Task 17 (The Rail / app shell).

## Key UX Patterns (from Shape of AI analysis)

These are integrated into `frontend-v2.md` and `tasks.md`:

1. **Suggestions** — contextual starter chips (generated from roll metadata stats) + follow-up chips after each query result
2. **Stream of Thought** — mono-font processing indicator showing query stages in real-time
3. **Actionable Interpreted Filters** — clickable/removable/addable filter chips for direct manipulation after NL query
4. **Selection flow** — click to select (no mode toggle), selection strip in chat input, three-tier dimming on results
5. **Preview panel** — slide-up panel for narrative judgment, gallery save integrated

## Key Interaction: Image-as-Prompt

Click images in grid → thumbnails appear in chat input strip with count → type text prompt → system averages selected image embeddings into centroid, blends with text embedding (0.7/0.3 weight) → pgvector nearest-neighbor search → results displayed with dimming. No vision calls — pure embedding math.

## Future Features (documented, not built)

- **Task 32: Narrative curation** — "create a sad story from my images" — LLM sequences selected images into a narrative arc using stored descriptions
- **Domain layers** — specialized metadata extraction for specific use cases (scientific, fashion)
- **Telegram/QR upload** — external contributors uploading to shared rolls
- **Pluggable models** — swap vision/embedding models per roll

## Working With This Codebase

- Read `plan/tasks.md` for what to build next
- Read `plan/frontend-v2.md` before any frontend task
- Read `plan/architecture.md` for backend context
- All Gemini model strings are in env vars — if a model is renamed, update `.env.local` and check `plan/stack.md` gotchas
- Never store full URLs in DB — use `getImageUrl()` from `lib/imagekit/url.ts`
- Never call vision models at query time
- Every table has RLS — use the admin client only in Inngest jobs
