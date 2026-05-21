# PLAN.md — Semantic Image Intelligence App

## What This Is

A Next.js web app that functions as a semantic image operating system. Users upload image collections ("rolls"), the system indexes every image once using a vision model (extracting rich structured metadata + vector embeddings), and all subsequent interactions happen through natural language chat against the stored index. No vision model is re-called at query time.

**Core loop:** Upload → Index (background, once) → Chat to filter/select → Save as shareable gallery.

## Who This Plan Is For

An AI coding agent (Claude Code). Each file in `plan/` is self-contained for its responsibility. Read only what you need for the current task.

## Plan Index

| File              | Contains                                                     | Read when...                                  |
| ----------------- | ------------------------------------------------------------ | --------------------------------------------- |
| `CONTEXT.md`      | Full project overview, current state, key decisions          | Starting a new chat session                   |
| `architecture.md` | Data flow, pipeline, ADRs, suggestion generation             | Starting any backend work                     |
| `stack.md`        | Tech stack with versions and gotchas                         | Setting up the project or adding a dependency |
| `structure.md`    | Folder layout, naming conventions, anti-patterns             | Creating any new file                         |
| `glossary.md`     | Domain vocabulary definitions                                | Any term is ambiguous                         |
| `setup.md`        | Manual pre-coding steps (DB, APIs, env vars, RLS)            | Before writing any code                       |
| `tasks.md`        | Numbered tasks (1–31 + future). 1–16 complete.               | Picking the next thing to build               |
| `testing.md`      | What to test, what to skip, how to run                       | Writing or running tests                      |
| `frontend.md`     | Full design system, all screens, selection flow, UX patterns | Building any UI                               |
| `prompt.md`       | Vision indexing prompt (system + user + config)              | Working on indexing or metadata extraction    |
| `dev.md`          | Run, build, lint commands                                    | Local development                             |

## Golden Workflow — Build Order

```
1. Setup       → Manual config (Supabase, ImageKit, API keys, env)
                  WHY FIRST: Everything else depends on live services.

2. Schema      → Database tables, RLS, pgvector extension
                  WHY SECOND: The schema is the contract. Get it wrong = rewrite everything above it.

3. Storage     → ImageKit upload + URL resolution utility
                  WHY THIRD: Can't index images you can't store/retrieve.

4. Indexing    → Inngest jobs: vision analysis + embedding generation
                  WHY FOURTH: The index is the product. Until this works, nothing else matters.

5. Query       → NL→filter translation + pgvector search + chat persistence
                  WHY FIFTH: Depends on indexed data existing. This is where value becomes visible.

6. Galleries   → Save filter results, public pages, layout options
                  WHY SIXTH: Output layer. Requires query to produce results first.

7. Frontend    → App shell (Rail), Command Center (chat + grid), selection flow,
                  dimming, preview panel, suggestions, stream of thought,
                  actionable filters, Image Detail, galleries, public gallery.
                  WHY LAST: Every UI component calls something built in steps 2-6.
                  Read frontend.md before starting this phase.
```

**Why this order protects you:**

- Schema errors discovered late force re-indexing (expensive: vision API costs + time).
- Building UI before the API is stable means constant rework.
- Indexing before storage means you can't test with real images.
- Each step is testable in isolation before the next begins.

## Key Decisions (Expensive to Reverse)

1. **Embedding model choice** → Gemini embeddings (`gemini-embedding-2-preview`). Switching models later requires re-embedding every image. See `plan/architecture.md` §ADR-003.
2. **pgvector in Supabase** → Vector search lives in Postgres. Moving to a dedicated vector DB later means data migration. Acceptable for MVP scale (≤1000 images/roll).
3. **ImageKit as storage** → Abstracted behind a URL resolver. Switching providers = change one function.
4. **Multi-tenant schema from day one** → `user_id` on every table + RLS. Cannot be retrofitted cheaply.
5. **Inngest for background jobs** → Switching job runners means rewriting all async workflows.

Important - Write clean code to explain the what and how, and reserve comments strictly and concisely for the why.
