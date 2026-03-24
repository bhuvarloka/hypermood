# Testing Strategy

## Philosophy

Test the things that would be expensive to debug in production. Skip the things that TypeScript or the framework already guarantees.

## What to Test

| Layer | What | How |
|---|---|---|
| Gemini vision prompt | Structured output parsing doesn't break on unexpected LLM responses | Unit test the JSON parser with edge cases (missing fields, extra fields, malformed JSON) |
| Gemini query interpreter | NL→filter translation produces valid query plans | Unit test with sample queries → expected filter shapes |
| Embedding utilities | Centroid calculation, vector blending logic | Unit test with known vectors |
| URL resolver | `getImageUrl` produces correct ImageKit URLs with transforms | Unit test |
| Inngest functions | Indexing pipeline handles success, partial failure, retries | Integration test with Inngest dev server |
| RLS policies | User A cannot read User B's data | Integration test: create two users, verify isolation |
| Server Actions | Core CRUD operations work and enforce auth | Integration test |
| Query pipeline (end-to-end) | NL query → vector search + filters → ranked results | Integration test with seeded data |

## What NOT to Test

- React component rendering (shadcn/ui is already tested by the library)
- Tailwind class application
- Next.js routing
- Supabase SDK methods (tested by Supabase)
- Gemini API availability (external service — mock it)

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
