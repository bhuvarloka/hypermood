# Architecture Review — Hypermood

> Based on codebase analysis + article: "Vibe Coding with AI: Best Practices for Human-AI Collaboration in Software Development" (Towards Data Science, 2025)

---

## Framing

The article's central argument: AI-assisted development accelerates code generation, but without active human oversight at each stage — architecture, implementation, review — the result tends toward unnecessary complexity, untested assumptions, and systems that work in demos but drift in production.

Hypermood is a clean domain problem: index images once, query forever via natural language. The architecture decisions recorded in `plan/architecture.md` are sound at the strategic level. The ADRs are well-reasoned, the tech stack is appropriate, and the "never call vision at query time" constraint is explicitly enforced. These are signs of good upfront design thinking.

The problems are at the implementation level — where AI-generated code ran ahead of design review.

---

## What the Article Gets Right, Applied Here

### Principle: "Beware of Over-Engineering"

> *"Because the system can generate complex architectures effortlessly and at little cost, it often does. Left unchecked, this can lead to designs that are far more complex than the problem requires."*

This is the dominant pattern in the Hypermood codebase. The strategic architecture is minimal and correct. The implementation layer is where complexity accumulated without measurement.

### Principle: "The AI concluded that none of the complex architectural changes are needed"

The article demonstrates the AI critiquing its own output and rolling back unnecessary additions. This self-critique loop is missing in Hypermood's implementation phase — code was generated, integrated, and not subsequently challenged.

---

## Critical Findings

### 1. The 3x Over-Fetch: An Untested Assumption Baked into Production

**Files:** [query-executor.ts:24](src/lib/gemini/query-executor.ts#L24), [image-search.ts:58](src/lib/gemini/image-search.ts#L58)

```typescript
const candidateLimit = Math.min(limit * 3, 300)  // query-executor.ts
const candidateLimit = Math.min(limit * CANDIDATE_MULTIPLIER + imageIds.length, 500)  // image-search.ts
```

The system routinely fetches 3–5x more rows from the database than it returns to the user, then discards the excess in JavaScript. This is the most concrete resource waste in the codebase.

**Why this matters architecturally:** The architecture document correctly specifies a two-stage retrieval (K=50–100 candidates → LLM reranks). But the implementation adds a third hidden stage — DB over-fetch → JS filter → pass to LLM — that is undocumented and unvalidated. The 3x multiplier is a guess. There is no measurement of actual filter loss rate for real queries.

**The article's lens:** This is a textbook case of AI generating a "safe" defensive pattern (over-fetch to ensure enough results) without the developer asking "what is the actual loss rate? Does 3x hold?" The human review step — challenge the assumption — never happened.

**Recommendation:** Instrument the query path. Log: `(candidates fetched) vs (candidates passed to LLM) vs (results returned)`. If filter loss is <20%, reduce multiplier to 1.5x or push filtering server-side via SQL. The 300/500 caps suggest this was also never stress-tested at scale.

---

### 2. Hand-Rolled Query Validation — Boilerplate That Fails Silently

**File:** [query.validate.ts:46-89](src/lib/gemini/query.validate.ts#L46)

The `validateQueryPlan()` function is 44 lines of manual `typeof` checks and array iteration. Every field has a null coalesce fallback to `DEFAULT_PLAN`. This means: if Gemini returns an unexpected shape, the system silently accepts default values rather than surfacing the mismatch.

**Why this matters:** The query plan is the contract between the LLM and the execution engine. Silent fallbacks here mean a malformed LLM response (wrong field name, unexpected operator, nested object where a string was expected) produces a generic "no results" experience with no log, no alert, and no diagnosis path.

**The article's lens:** The article warns about garbage-in-garbage-out. Here, the LLM is the input source — and the validation layer is designed to swallow garbage quietly.

**Recommendation:** Replace with Zod. The schema is well-defined in the architecture doc. A Zod parse failure should surface in logs with the raw LLM output attached. Silent defaults are appropriate for UI presentation; they are not appropriate for query execution.

---

### 3. Nine Inngest Steps for a Linear Pipeline

**File:** [index-image.ts](src/lib/inngest/functions/index-image.ts)

The image indexing job uses 9 `step.run()` calls for what is architecturally described as a three-phase pipeline: download → analyze → save. The granularity is: fetch-image, set-status-indexing, download-image, analyze-image, save-metadata, embed-image, save-embedding, set-status-indexed, check-roll-complete.

Each `step.run()` is a serialization boundary — Inngest checkpoints state, which enables retry durability. But nine checkpoints for a sequential pipeline creates nine coordination round-trips and nine points of intermediate state to manage.

**Specific problem:** `check-roll-complete` runs after every single image. For a roll of 100 images, this is 100 `count(*) WHERE status IN ('pending','indexing')` queries — 99 of which will return non-zero and do nothing. The architecture doc describes this correctly in principle ("when count hits 0, fire event") but the implementation queries on every image rather than reasoning about when it's worth checking.

**Recommendation:** Consolidate to 3–4 steps: (1) validate and set status, (2) download + analyze + embed as a unit (single retry boundary for the expensive work), (3) persist results transactionally, (4) check completion. The completion check is fine where it is — just accept the wasted queries until scale proves otherwise, but document that it's intentional.

---

### 4. Duplicate MIME Detection — The Invisible Maintenance Tax

**Files:** [vision.validate.ts:154](src/lib/gemini/vision.validate.ts#L154), [embedding.ts:38](src/lib/gemini/embedding.ts#L38)

Identical `detectMimeType(buffer: Buffer): string` functions exist in two modules. The one in `embedding.ts` is private, preventing reuse.

This is a small issue in isolation. It is significant as a signal: AI code generation tends to produce self-contained modules that copy utilities rather than reference shared ones, because the local context (current file) is more salient than the global codebase. Without a human review pass looking specifically for duplication, this accumulates.

**Recommendation:** One canonical `detectMimeType` in `src/lib/gemini/utils.ts`, exported, imported by both callers. This is a 5-minute fix. More importantly, establish a review step that specifically looks for duplication before integration.

---

### 5. Type Safety Abandoned at the Critical Path

**Files:** [query-executor.ts:26](src/lib/gemini/query-executor.ts#L26), [image-search.ts:60](src/lib/gemini/image-search.ts#L60)

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any
```

The entire Supabase client is cast to `any` to call `.rpc()`. The `eslint-disable` comment is a flag that someone knew this was wrong and merged it anyway.

**Why this is specifically dangerous here:** `rpc()` calls are vector search — the core query execution path. Type errors in this path are runtime query failures, not compile-time catches. The TypeScript investment across the codebase (strict mode throughout) provides no protection at the exact point where it matters most.

**Recommendation:** Extend the Supabase client type with the specific RPC signatures needed. This is a one-time declaration merge. Alternatively, create a typed wrapper: `function vectorSearch(params: VectorSearchParams): Promise<SearchResult[]>` that encapsulates the `as any` internally and exposes a typed API to the rest of the system.

---

### 6. The ALLOWED_METADATA_FIELDS Whitelist — Three Places to Update

**File:** [query-executor.logic.ts:8-49](src/lib/gemini/query-executor.logic.ts#L8)

A 42-field hardcoded `Set` defines which metadata fields are queryable. A separate `arrayFields` Set partially duplicates this for array-specific handling. Adding a new metadata field to the vision schema (in `domain.ts` and the Gemini prompt) requires a third manual update here.

**The article's lens:** The article's architecture-first principle exists precisely to prevent this. If the queryable field set had been derived from the domain schema rather than hardcoded separately, this would be a one-change update. Instead, it is a silent failure — add a field, forget to update the Set, queries against that field silently return no results.

**Recommendation:** Derive ALLOWED_METADATA_FIELDS from the domain types or generate it. At minimum, add a comment that explicitly names all three files that must be updated in sync. Better: a build-time test that fails when domain.ts and query-executor.logic.ts diverge.

---

### 7. Premature Micro-Optimizations Without Measurement

**Files:** [roll-image-grid.tsx:32-78](src/components/roll/roll-image-grid.tsx#L32), [ChatInterface.tsx:303](src/components/chat/ChatInterface.tsx#L303)

Two optimization patterns appear in the codebase with no profiling evidence:

- `requestAnimationFrame` batching of Realtime updates in the image grid (47 lines of buffer/RAF/Map complexity)
- `useMemo` on image map in ChatInterface with comment "initialImages can have up to 1000 entries"

Both exist because AI-generated code tends to include "safe" performance patterns for perceived worst cases. Realtime image updates arrive one at a time from Inngest — they will not burst within a single animation frame under any realistic usage. `useMemo` on a 1000-element array is negligible compared to the re-renders it protects against, which are triggered by the 11 other `useState` hooks in the same component.

**The article's lens:** This is the same pattern as adding BM25 + Knowledge Graph + Timeline Synthesizer for a news article search — solutions generated for edge cases that are unlikely to occur. The article's recommendation is direct: ask "will users actually encounter this?" If you can't measure it, remove the optimization.

**Recommendation:** Remove the RAF batching, replace with direct `setState`. Remove the `useMemo` unless a profiler shows it in a hot path. Document that these were removed after review, so future AI passes don't re-add them.

---

## What Is Working Well

These are deliberate design choices that should not be disturbed:

- **ADR-005 (no vision at query time)** — enforced, correct, explicitly documented. This is the core cost control mechanism and it holds.
- **Multi-tenant from day one** — RLS on every table is the right call and would be expensive to retrofit.
- **Storage abstraction** — `getImageUrl()` as the single URL resolution point is exactly the right abstraction depth for this problem.
- **Template-based suggestion generation** — the choice to use SQL aggregation rather than an LLM call for roll suggestions is a good example of using the simplest tool that works.
- **ADR-003 rationale** — the Gemini Embedding 2 decision is well-documented including migration cost ($0.02, 10 minutes). This is the kind of explicit cost awareness the article advocates.
- **Deduplication on roll-complete events** — the 5-minute window deduplication ID is a thoughtful solution to a real race condition.

---

## Priority Recommendations

| Priority | Finding | Status | Action |
|----------|---------|--------|--------|
| High | 3x over-fetch is unmeasured | Open | Instrument the query path, then right-size the multiplier |
| High | `as any` on Supabase client | **Fixed 2026-03-26** | RPC calls now fully typed via the `Database` generic — `as any` casts and `eslint-disable` comments removed from `query-executor.ts` and `image-search.ts` |
| High | Silent fallbacks in query validation | **Fixed 2026-03-26** | `validateQueryPlan` rewritten with Zod 4. Invalid shapes now log to console with raw LLM output for diagnosis. All 31 existing tests pass. |
| Medium | 9 Inngest steps | Open | Consolidate to 3–4; document rationale for step granularity |
| Medium | ALLOWED_METADATA_FIELDS whitelist | Open | Add a test or comment that enforces sync with domain types |
| Low | Duplicate MIME detection | Open | Consolidate to `src/lib/gemini/utils.ts` |
| Low | RAF batching in image grid | Open | Remove; replace with direct setState |
| Low | `useMemo` on imageMap | Open | Remove unless profiler shows it in a hot path |

---

## Process Recommendation

The article's core loop — **Prompt → Generate → Review → Feedback → Iterate** — was applied at the architecture level (the plan/ directory is evidence of this) but not consistently at the implementation level. The result is a well-designed system with implementation-layer complexity that accumulated without a review gate.

For the remaining tasks (26–33), establish a lightweight review step after each task completion:

1. Does the implementation match what the architecture describes?
2. Is there any measurement missing that a magic number assumes?
3. Are there any `as any`, `// eslint-disable`, or similar override comments that signal unresolved type problems?
4. Is there duplicate code that would need to be updated in multiple places if requirements change?

The codebase is in good shape overall. The issues above are the kind that compound quietly — each one is small, but together they create the "works in demos, drifts in production" pattern the article warns against.
