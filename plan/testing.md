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

## Running Tests

```bash
# Unit tests
pnpm test

# Integration tests (requires .env.local with test credentials)
pnpm test:integration

# Watch mode
pnpm test --watch
```

## Test File Location

Colocate test files next to the module they test:
```
lib/gemini/vision.ts
lib/gemini/vision.test.ts
lib/imagekit/url.ts
lib/imagekit/url.test.ts
```
