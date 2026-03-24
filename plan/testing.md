# Testing Strategy

## Philosophy

Test the things that would be expensive to debug in production. Skip the things that TypeScript or the framework already guarantees.

## What to Test

| Layer                       | What                                                                | How                                                                                      |
| --------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Gemini vision prompt        | Structured output parsing doesn't break on unexpected LLM responses | Unit test the JSON parser with edge cases (missing fields, extra fields, malformed JSON) |
| Gemini query interpreter    | NL→filter translation produces valid query plans                    | Unit test with sample queries → expected filter shapes                                   |
| Embedding utilities         | Centroid calculation, vector blending logic                         | Unit test with known vectors                                                             |
| URL resolver                | `getImageUrl` produces correct ImageKit URLs with transforms        | Unit test                                                                                |
| Inngest functions           | Indexing pipeline handles success, partial failure, retries         | Integration test with Inngest dev server                                                 |
| RLS policies                | User A cannot read User B's data                                    | Integration test: create two users, verify isolation                                     |
| Server Actions              | Core CRUD operations work and enforce auth                          | Integration test                                                                         |
| Query pipeline (end-to-end) | NL query → vector search + filters → ranked results                 | Integration test with seeded data                                                        |

## What NOT to Test

- Pure layout components with no conditional logic (no branching, no state)
- Tailwind class application
- Next.js routing
- Supabase SDK methods (tested by Supabase)
- Gemini API availability (external service — mock it)

## What to Test in the Frontend (Phase 3 prep)

Components with real logic are worth unit testing with Vitest + React Testing Library before Cypress covers the full flows:

- Selection state (dimming, count badge, clear)
- Loading / error / empty states in the gallery grid
- Chat message rendering (user vs assistant, clarification notes)
- Suggestion chip rendering and click behavior

## Testing Phases

**Phase 1 — Unit:** Pure logic, no I/O, ~300ms. Done.

**Phase 2 — Integration (after seeding data):** Real Supabase queries against a test project with seeded images. Catches SQL bugs, RLS violations, and ordering issues that unit tests cannot. Blocked until the database has real indexed data — run these once the upload + indexing pipeline is working end-to-end.

**Phase 3 — E2E with Cypress (after frontend is stable, tasks 17–31):** Drive a real browser through full user flows — upload a roll, wait for indexing, search, verify results, save a gallery. Only worth writing once the UI is stable; Cypress tests against structure and selectors that change frequently during development will break constantly and cost more to maintain than they catch.

## Test Setup

- Framework: Vitest (fast, TS-native, compatible with Next.js)
- Mocks: Mock Gemini API responses for unit tests. Use real Supabase (test project or local) for integration tests.
- Seed data: Create a small set of pre-indexed images (5-10) with known metadata and embeddings for query testing.
- Pure logic is extracted into `*.validate.ts` / `*.logic.ts` / `*.math.ts` siblings so tests can import without I/O or side effects. Production files import from them; no test code ever lives in `src/`.

## Running Tests

```bash
# Unit tests
pnpm test

# Integration tests (requires .env.test with test credentials)
pnpm test:integration

# Watch mode
pnpm test:watch
```

## Test File Location

All test files live under `tests/` at the project root — zero `*.test.ts` files inside `src/`.

```
tests/
  unit/
    parse-utils.test.ts
    vision.test.ts
    query-executor.test.ts
    image-search.test.ts
    query.test.ts
    exif.test.ts
    url.test.ts
  integration/
    query-executor.integration.test.ts
    image-search.integration.test.ts
```

The extracted pure-logic files they test:

```
src/lib/gemini/vision.validate.ts
src/lib/gemini/query-executor.logic.ts
src/lib/gemini/image-search.math.ts
src/lib/gemini/query.validate.ts
src/lib/gemini/parse-utils.ts       ← already fully exported, no extraction needed
src/lib/exif/extract.ts             ← already fully exported, no extraction needed
src/lib/imagekit/url.ts             ← already fully exported, no extraction needed
```

For full detail on test cases, bugs identified, and infrastructure setup see `plan/plan-extensions/testing-plan.md`.
