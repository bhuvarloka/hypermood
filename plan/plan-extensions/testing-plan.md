# Test Suite Plan — Foundation (Tasks 1–16)

## Philosophy

Tests that **catch bugs**, not confirm existing behavior. Focus on: parse/validate logic, SQL clause building, vector math, and type safety at boundaries. Skip React rendering, Next.js routing, Supabase SDK internals, and Gemini API availability.

---

## Architecture: How to Test Private Logic Without Polluting Production

Private functions inside `vision.ts`, `query-executor.ts`, etc. cannot be imported by tests because they are not exported. The fix: **extract pure logic into separate `*.validate.ts` / `*.logic.ts` / `*.math.ts` files** that are fully exported. The original production file imports from them. Tests import directly from the extracted file.

**All test files live in `tests/` at the project root — zero `*.test.ts` files inside `src/`.**

### Folder layout

```
hypermood/
  src/
    lib/
      gemini/
        vision.ts                   ← production public API (unchanged behavior)
        vision.validate.ts          ← pure logic extracted from vision.ts
        query-executor.ts           ← production public API (unchanged behavior)
        query-executor.logic.ts     ← pure logic extracted from query-executor.ts
        image-search.ts             ← production public API (unchanged behavior)
        image-search.math.ts        ← pure logic extracted from image-search.ts
        query.ts                    ← production public API (unchanged behavior)
        query.validate.ts           ← pure logic extracted from query.ts
        parse-utils.ts              ← already fully exported, no change
      exif/
        extract.ts                  ← already fully exported, no change
      imagekit/
        url.ts                      ← already fully exported, no change
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

Each extracted file (e.g. `vision.validate.ts`) is **legitimate library code** — pure functions with no side effects, no I/O, no env var reads. They belong in `src/lib/` regardless of tests. Production files import from them; tests import from them. No `_test` hacks. No test code in `src/`.

**`parse-utils.ts`, `exif/extract.ts`, and `imagekit/url.ts` are already fully exported — no extraction needed.**

---

## Infrastructure Setup

### Files to create

**`vitest.config.ts`** (unit tests):
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

**`vitest.integration.config.ts`** (integration tests, real Supabase):
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    testTimeout: 30000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

**`package.json` scripts to add:**
```json
"test": "vitest run",
"test:watch": "vitest",
"test:integration": "vitest run --config vitest.integration.config.ts"
```

### Critical: `@google/genai` module-load mock

`parse-utils.ts` instantiates `new GoogleGenAI(...)` at module load time. Any test file that imports `parse-utils.ts` (directly or transitively) must mock this module before it loads:

```ts
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockReturnValue({ models: { generateContent: vi.fn() } }),
  ThinkingLevel: { LOW: 'LOW' },
}))
```

This only applies to `parse-utils.test.ts`. The new `*.validate.ts` and `*.logic.ts` files have **no Gemini dependency** — they are pure TypeScript. No mocking needed for those tests.

---

## Unit Tests (7 files, ~125 cases)

### `tests/unit/parse-utils.test.ts`
Imports `parse-utils.ts` via `@/lib/gemini/parse-utils`. Must mock `@google/genai` (see above).

**`tryParseJson`:**

- Valid JSON string → parsed object
- ` ```json\n{}\n``` ` → strips markdown fence with language tag
- ` ```\n{}\n``` ` → strips fence without language tag
- String with control chars (`\x07`, etc.) → stripped, parse succeeds
- Newline (`\x0a`) and tab (`\x09`) preserved — NOT stripped by the regex
- Completely unparseable string → `null`
- Empty string → `null`
- JSON array string → returns array (not just objects)
- JSON primitive (number, boolean) → returns the primitive

**`asRecord`:**
- Plain object → returned as-is
- **`asRecord([1,2,3])` → should be `null`, but currently returns the array** — `typeof [] === 'object'` is true. This is bug #1. Write the test to catch the current wrong behavior.
- `null` → `null`
- `string` → `null`
- `number` → `null`
- `boolean` → `null`
- `undefined` → `null`

---

### `tests/unit/vision.test.ts` (imports from `src/lib/gemini/vision.validate.ts`)

**What to extract into `vision.validate.ts`:**
- `clamp`, `ensureStringArray`, `ensureString`, `ensureBool`, `ensurePosition`
- `validateObject`, `validatePerson`, `validateMetadata`
- `detectMimeType`
- `DEFAULTS`, `VALID_POSITIONS`

`vision.ts` refactors to import these from `vision.validate.ts`. No behavior change.

**`detectMimeType`:**
- PNG magic bytes `[0x89, 0x50, ...]` → `'image/png'`
- JPEG magic bytes `[0xFF, 0xD8, ...]` → `'image/jpeg'`
- WebP: check requires correct bytes at positions 0–3 AND 8–11 — test partial match (only positions 0–3) does NOT return `'image/webp'`
- GIF magic bytes `[0x47, 0x49, ...]` → `'image/gif'`
- Unknown bytes / all zeros → `'image/jpeg'` fallback
- **Buffer shorter than 12 bytes hits early-return guard before PNG/JPEG check** → returns `'image/jpeg'` even for `[0x89, 0x50]`. Documents bug #4 — a valid tiny PNG header is misidentified.
- Empty buffer → `'image/jpeg'`, no crash

**`validateMetadata`:**
- `null` / `undefined` / `{}` → returns DEFAULTS
- Object with empty label `''` → filtered from `objects[]`
- Object with `null` label → filtered from `objects[]`
- Invalid `prominence` (e.g., `'dominant'`) → falls back to `'secondary'`
- Invalid `position` (e.g., `'upper-left'`) → falls back to `'center'`
- Tags uppercased (`['SUNSET']`) → lowercased in result
- Tags with non-string elements (numbers, nulls) → filtered out
- `energy_level: -0.5` → clamped to `0.0`
- `energy_level: 1.5` → clamped to `1.0`
- `energy_level: NaN` → fallback `0.5` (fails `Number.isFinite`)
- `energy_level: Infinity` → fallback `0.5`
- `quality_score: 2.0` → `1.0`; `quality_score: -1.0` → `0.0`
- `blur_score: 1.1` → `1.0`; `blur_score: -0.1` → `0.0`
- `people.count: 'two'` (not a number) → falls back to `descriptions.length`
- `people.count: 5` with 1 description → count stays `5` (not overridden by array length)
- `people.count: 0` → `0` — zero passes `typeof === 'number'`, is not defaulted
- `is_screenshot: 'true'` (string) → `false` (fails `typeof === 'boolean'`)
- `subject: ''` (empty string) → falls back to `'unknown image'` (`ensureString` rejects empty)
- Full valid complete payload → passes through without any field being defaulted (regression guard)

---

### `tests/unit/query-executor.test.ts` (imports from `src/lib/gemini/query-executor.logic.ts`)

**What to extract into `query-executor.logic.ts`:**
- `IMAGES_TABLE_COLUMNS`, `ALLOWED_METADATA_FIELDS`
- `toJsonbContainmentPath`, `toJsonbScalarPath`
- `buildClause`
- `matchesFilter`
- `getNestedValue`

`query-executor.ts` imports these from `query-executor.logic.ts`. No behavior change.

**`buildClause` — SQL injection guards & output correctness:**
- Field not in `ALLOWED_METADATA_FIELDS` (e.g., `'user_id'`, `"injected; DROP TABLE--"`) → `null` (allowlist guard)
- `objects[].label` with `operator: 'eq'` (not `'contains'`) → `null`
- `objects[]` with no leaf field after `[].` → `null`
- `objects[].label` with `contains` → `@>` clause containing `[{"label":"cat"}]::jsonb`
- `tags` with `contains` → `@> '["sunset"]'::jsonb`
- `description` with `contains` → `ilike '%beach%'`
- **`contains` with value `"it's a test"` → `ilike '%it''s a test%'`** — single quote doubled. SQL injection test.
- `scene.setting` with `eq: 'indoor'` → `(im.metadata->'scene'->>'setting' = 'indoor')`
- **`eq` with value `"'; DROP TABLE images;--"` → all single quotes doubled, no raw unescaped `'` in final clause**
- `neq` → `!=` in clause
- `gte` → `::numeric >= value`
- **`gte` with non-numeric string value `'high'` → clause contains `NaN`** — bug #2. Documents that `Number('high')` produces `NaN`, yielding invalid SQL that throws at runtime.
- `in` with `['indoor', 'outdoor']` → `IN ('indoor', 'outdoor')`
- `in` with empty array → `null`
- `in` with non-array value → `null`
- `in` values containing single quotes → each value has quotes escaped
- Unknown operator (e.g., `'like'`) → `null`
- Nested field `scene.setting` → `im.metadata->'scene'->>'setting'` (jsonb on intermediate, text on last)
- Single-segment field `quality_score` → `im.metadata->>'quality_score'` (only one `->>`)

**`matchesFilter` — client-side filtering logic:**
- `eq` with matching string → `true`
- `eq` with non-matching string → `false`
- **`eq` loose `==`: `{ count: 0 }` with filter value `'0'` → `true`** — documents that equality is loose (`==`), not strict (`===`)
- `contains` on array → uses `Array.includes` (strict, case-sensitive)
- **`contains` on array `['Sunset']` with filter value `'sunset'` → `false`** — bug #3. Array path is case-sensitive, but the SQL `ilike` path is case-insensitive. The two paths produce different results for the same data.
- `contains` on string field → case-insensitive substring match
- `contains` on numeric field (not array, not string) → `false`
- `lte` at equal boundary value → `true` (≤ includes the boundary)
- `gt` at equal boundary value → `false` (> excludes the boundary)
- `gte` / `lt` correct direction
- `in` → returns `true` when actual value is in the filter's value array
- `in` → returns `false` when actual value is not in the array
- Array-element filter `objects[].label contains 'cat'` → `true` when one element matches
- Array-element filter → `false` when no element matches
- Array-element filter on non-array field → `false`
- Array-element filter with non-`contains` operator → `true` (documented pass-through behavior at line 239)
- Unknown operator → `true` (default case, no crash)

**`getNestedValue`:**
- Single key `'a'` on `{ a: 1 }` → `1`
- Dot-path `'scene.setting'` → correct nested value
- Missing key → `undefined`
- `null` at intermediate node → `undefined`, no crash
- Non-object at intermediate node (e.g., `scene` is `'beach'`) → `undefined`
- **Empty string path `''` → returns the full object** — `''.split('.').filter(Boolean)` is `[]`, zero iterations. Bug #5: a filter with `field: ''` would compare the entire metadata blob, producing wrong results.
- Path with trailing dot `'a.b.'` → same result as `'a.b'` (trailing empty segment removed by `filter(Boolean)`)

---

### `tests/unit/image-search.test.ts` (imports from `src/lib/gemini/image-search.math.ts`)

**What to extract into `image-search.math.ts`:**
- `computeCentroid`
- `l2Normalise`
- `CENTROID_WEIGHT`, `TEXT_WEIGHT`

`blendWithText` calls `embedText` (Gemini dependency) so it stays in `image-search.ts`. Test it via the public `searchByImageReferences` with Supabase + embedding mocked — or extract a sync `blendVectors(centroid, textVec)` helper into `image-search.math.ts` that `blendWithText` calls.

**`computeCentroid`:**
- Single vector `[[1,2,3]]` → `[1,2,3]` (no distortion from averaging)
- Two equal vectors → same vector
- `[[0,2],[2,0]]` → `[1,1]`
- `[[3,0,0],[0,3,0],[0,0,3]]` → `[1,1,1]`
- `[[1],[2]]` → `[1.5]` (float result, not truncated to integer)
- Negative values: `[[-1,-1],[1,1]]` → `[0,0]`
- All-zero vectors → zero vector (no division-by-zero, just `[0,0,...]`)

**`l2Normalise`:**
- `[1,0,0]` → `[1,0,0]` (already unit vector, unchanged)
- **`[0,0,0]` → `[0,0,0]`, not `[NaN,NaN,NaN]`** — zero-vector guard: if `norm === 0`, returns `vec` unchanged
- `[3,4]` → `[0.6, 0.8]` (classic 3-4-5 triangle, ±1e-10 tolerance)
- `[-3,-4]` → `[-0.6,-0.8]` (negative values)
- `[5]` → `[1]` (single element)
- Invariant: `Math.sqrt(result.reduce((a,v) => a+v*v, 0)) ≈ 1.0` for any non-zero input
- Near-denormal values (e.g., `[1e-310, 1e-310]`) → result is finite, not NaN or Infinity

**`blendVectors` (sync helper to extract from `blendWithText`):**
- `centroid=[0,1]`, `textVec=[1,0]` → `[0.3, 0.7]` (CENTROID_WEIGHT=0.7, TEXT_WEIGHT=0.3)
- **`textVec` shorter than centroid → missing dimensions filled with `0`** (`textVec[i] ?? 0` guard)
- Constants check: `CENTROID_WEIGHT + TEXT_WEIGHT === 1.0`

---

### `tests/unit/url.test.ts` (imports from `src/lib/imagekit/url.ts`)

Use `vi.stubEnv` for the env var, `vi.mock('@imagekit/next')` for `buildSrc`.

- Missing env var → throws `Error("NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT is not configured")`
- No transforms argument → `buildSrc` called with `transformation: undefined` (not `[{}]`)
- Full transforms `{ width, height, quality, format }` → passed as `[{ width, height, quality, format }]`
- Partial transforms `{ width: 400 }` → `transformation: [{ width: 400, height: undefined, quality: undefined, format: undefined }]`
- Return value passes through from `buildSrc`

---

### `tests/unit/query.test.ts` (imports from `src/lib/gemini/query.validate.ts`)

**What to extract into `query.validate.ts`:**
- `VALID_OPERATORS`, `DEFAULT_PLAN`
- `validateQueryPlan`
- Types: `FilterOperator`, `QueryFilter`, `QuerySort`, `QueryPlan` (re-exported from here, `query.ts` re-exports them for the rest of the app)

**`validateQueryPlan`:**
- `null` / non-object → `DEFAULT_PLAN` (`{ filters: [], semantic_search: null, sort: null, limit: 50, clarification_note: null }`)
- Filter with invalid operator → dropped
- Filter with empty `field` string → dropped
- Filter with non-object item (e.g., a raw string) → dropped
- Valid filter → passes through unchanged
- `semantic_search: ''` → `null`
- `semantic_search: '   '` (whitespace only) → `null`
- `semantic_search: '  beach  '` → `'beach'` (trimmed)
- `limit: 500` → clamped to `200`
- `limit: 0` → clamped to `1`
- `limit: 25.7` → `26` (`Math.round`)
- `limit: Infinity` → `50` (fails `Number.isFinite`)
- `limit: NaN` → `50`
- Sort with invalid direction `'ascending'` → `sort: null`
- Sort with valid `{ field: 'quality_score', direction: 'desc' }` → passes through
- `clarification_note: ''` → `null`
- `clarification_note: '  '` → `null`
- `clarification_note: '  Ambiguous query.  '` → `'Ambiguous query.'` (trimmed)

---

### `tests/unit/exif.test.ts` (imports from `src/lib/exif/extract.ts`)

Mock `exifr` via `vi.mock('exifr')`.

- Valid tags → all three fields populated
- `parse` returns `null` → `{ capturedAt: null, width: null, height: null }`
- `DateTimeOriginal` is a raw string (not `Date`) → `capturedAt: null` (instanceof guard)
- `ExifImageWidth` is a string `'4000'` → `width: null` (typeof guard)
- `parse` throws → returns all-null without uncaught exception (catch block)
- Partial EXIF (only `ExifImageWidth`) → `{ capturedAt: null, width: 1920, height: null }`
- `parse` called with `{ pick: ['DateTimeOriginal', 'ExifImageWidth', 'ExifImageHeight'], reviveValues: true }`

---

## Integration Tests

Require a real Supabase test project or local Supabase CLI. Use `.env.test`. Run via `pnpm test:integration`. CI-only.

**`tests/integration/query-executor.integration.test.ts`:**
- Metadata-only filter returns only images matching the filter (seeded with known tags)
- `limit` is honored — with 10 seeded images and limit 3, result length ≤ 3
- Impossible filter value → `{ images: [], total: 0 }`
- Sort by `uploaded_at asc` → ordering matches DB order
- RLS isolation: user A's query returns only user A's images, not user B's

**`tests/integration/image-search.integration.test.ts`:**
- Reference image ID is excluded from results
- Empty `imageIds []` → returns `[]` immediately (no DB query)
- Row with different `embedding_model_version` → excluded from centroid computation

---

## Bugs Identified (Tests Will Surface)

| # | File | Bug | Test that catches it |
|---|------|-----|----------------------|
| 1 | `parse-utils.ts` | `asRecord([1,2,3])` returns the array — `typeof [] === 'object'` is `true` | `asRecord — array input → null` |
| 2 | `query-executor.logic.ts` | `buildClause` with `gte` + non-numeric string → `::numeric >= NaN` (invalid SQL, throws at runtime) | `buildClause — gte with non-numeric value` |
| 3 | `query-executor.logic.ts` | `matchesFilter` array `contains` is case-sensitive (`Array.includes`), but SQL `ilike` path is case-insensitive — same data, different results depending on code path | `matchesFilter — contains on array, case sensitivity` |
| 4 | `vision.validate.ts` | `detectMimeType`: buffer < 12 bytes triggers early return before PNG/JPEG magic checks — `[0x89, 0x50]` misidentified as JPEG | `detectMimeType — buffer shorter than 12 bytes` |
| 5 | `query-executor.logic.ts` | `getNestedValue('')` returns the whole metadata object — empty `field` would evaluate filters incorrectly | `getNestedValue — empty string path` |

---

## Files to Create or Modify

| Action | File |
|--------|------|
| Create | `vitest.config.ts` |
| Create | `vitest.integration.config.ts` |
| Create | `src/lib/gemini/vision.validate.ts` |
| Create | `src/lib/gemini/query-executor.logic.ts` |
| Create | `src/lib/gemini/image-search.math.ts` |
| Create | `src/lib/gemini/query.validate.ts` |
| Create | `tests/unit/parse-utils.test.ts` |
| Create | `tests/unit/vision.test.ts` |
| Create | `tests/unit/query-executor.test.ts` |
| Create | `tests/unit/image-search.test.ts` |
| Create | `tests/unit/query.test.ts` |
| Create | `tests/unit/exif.test.ts` |
| Create | `tests/unit/url.test.ts` |
| Create | `tests/integration/query-executor.integration.test.ts` |
| Create | `tests/integration/image-search.integration.test.ts` |
| Refactor | `src/lib/gemini/vision.ts` — import from `vision.validate.ts` |
| Refactor | `src/lib/gemini/query-executor.ts` — import from `query-executor.logic.ts` |
| Refactor | `src/lib/gemini/image-search.ts` — import from `image-search.math.ts` |
| Refactor | `src/lib/gemini/query.ts` — import from `query.validate.ts` |
| Modify | `package.json` — add `test`, `test:watch`, `test:integration` scripts |

Production behavior is unchanged. The refactors are pure moves with no logic changes.

---

## Running Tests

```bash
pnpm test                  # ~125 unit tests, no network calls, < 5s
pnpm test:watch            # dev loop
pnpm test:integration      # requires .env.test with real Supabase credentials
```
