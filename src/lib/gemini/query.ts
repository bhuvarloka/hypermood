import { ai, tryParseJson } from './parse-utils'
import { validateQueryPlan, DEFAULT_PLAN } from './query.validate'
import { embedText } from './embedding'
import type { QueryPlan } from './query.validate'

const QUERY_MODEL = process.env.GEMINI_QUERY_MODEL ?? 'gemini-3-flash-preview'

// Re-export types so existing imports from '@/lib/gemini/query' continue to work.
export type { FilterOperator, QueryFilter, QuerySort, QueryPlan } from './query.validate'

// Cached system prompt resource name; populated on first use.
let cachedSystemPromptName: string | null = null
let cacheInitPromise: Promise<void> | null = null

async function initSystemPromptCache(): Promise<void> {
  try {
    const cache = await ai.caches.create({
      model: QUERY_MODEL,
      config: {
        displayName: 'hypermood-query-system-prompt',
        systemInstruction: SYSTEM_PROMPT,
        ttl: '3600s',
      },
    })
    cachedSystemPromptName = cache.name ?? null
  } catch (err) {
    // Context caching may not be available for this model/region — degrade to inline system prompt.
    console.warn('[query] System-prompt cache init failed:', err)
    cachedSystemPromptName = null
  }
}

const SYSTEM_PROMPT = `You are a query interpreter for a semantic image search engine. Your job is to translate natural language queries into a structured JSON query plan that the system will use to filter and rank images.

You have access to the following indexed metadata for each image. All fields are nested under a "metadata" JSONB column, accessed with dot notation (e.g., "scene.setting", "technical.is_screenshot").

AVAILABLE FIELDS AND THEIR TYPES:

subject (string): One-phrase description of what the image is fundamentally about.

objects (array of objects):
  - objects[].label (string): what the object is — e.g., "cat", "laptop", "car"
  - objects[].prominence (string): "primary" | "secondary" | "background"

people.count (number): number of people visible

colors.dominant (string[]): top hex color codes
colors.palette_mood (string): "warm" | "cool" | "neutral" | "mixed" | "monochromatic" | "vibrant" | "muted" | "pastel" | "dark" | "high-contrast"
colors.dominant_color_name (string): plain English name of most dominant color

scene.setting (string): "indoor" | "outdoor" | "mixed" | "not applicable"
scene.time_of_day (string): "dawn" | "morning" | "midday" | "afternoon" | "golden hour" | "sunset" | "dusk" | "night" | "artificial lighting" | "unknown"

composition.framing (string): "extreme close-up" | "close-up" | "medium close-up" | "medium shot" | "medium wide" | "wide shot" | "extreme wide" | "overhead" | "birds-eye" | "flat lay"

technical.is_screenshot (boolean)
technical.is_graphic (boolean)
technical.orientation (string): "landscape" | "portrait" | "square"

quality_score (number 0–1): overall image quality — 0 = unusable, 1 = professional

text_content.has_text (boolean)
text_content.text_strings (string[]): readable text found in the image
text_content.text_role (string): "signage" | "label" | "overlay/graphic" | "document" | "watermark" | "incidental" | "none"

description (string): full natural language description of the image
tags (string[]): 15-25 freeform semantic tags

VALID OPERATORS:
- "eq": exact string/boolean/number match
- "neq": not equal
- "contains": string/array contains value (use for tags, text_strings, objects by label, clothing)
- "gte" / "lte" / "gt" / "lt": numeric comparisons (blur_score, quality_score, energy_level, people.count)
- "in": value is one of an array of options

RULES:
1. Prefer "semantic_search" for vague or conceptual queries ("happy moments", "travel vibes", "something calm"). Use filters for precise structural criteria.
2. Combine both when the query has both a conceptual element AND precise criteria.
3. For queries about specific objects, things, or items (e.g. "vase", "cat", "car"), generate TWO filters: one "contains" on "objects[].label" AND one "contains" on "tags". Also set semantic_search to the item name. This ensures partial label matches (e.g. "porcelain vase") and tag matches both find the image.
4. For text in images, use "contains" on "text_content.text_strings".
5. Keep filters minimal — only add what was explicitly or strongly implied by the query. Over-filtering excludes relevant results.
7. For queries about people being present ("portraits", "people", "faces", "someone", "a person"), use { field: "people.count", operator: "gte", value: 1 }. Only use "eq" with value 0 when the query explicitly asks for NO people ("without people", "no people", "empty scenes").
8. limit: default 50, max 200. Increase for "show me all" style requests.
9. For greetings, questions about the system, or completely non-search messages: return filters=[], semantic_search=null, sort=null, limit=50, and explain in clarification_note.
10. For ambiguous queries: return your best-effort plan AND set clarification_note explaining what you assumed.
11. Translate ONLY the current query into filters. Do not carry over, inherit, or reference any prior filters — the caller handles filter accumulation. Treat every query as an independent translation task.

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation. Just the JSON.`

function buildUserPrompt(
  query: string,
  activeFilters?: import('./query.validate').QueryFilter[],
): string {
  const contextBlock = activeFilters && activeFilters.length > 0
    ? `\n\nCurrently active filters (already applied to the result set — your clarification_note must acknowledge these if relevant):\n${JSON.stringify(activeFilters, null, 2)}\n`
    : ''

  return `Translate this query into a JSON filter plan: "${query}"${contextBlock}

Return a JSON object with exactly this structure:

{
  "filters": [
    {
      "field": "dot.notation.field.path",
      "operator": "eq | neq | contains | gte | lte | gt | lt | in",
      "value": <any>
    }
  ],
  "semantic_search": "text to embed and search by similarity, or null",
  "sort": { "field": "dot.notation.field", "direction": "asc | desc" } or null,
  "limit": 50,
  "clarification_note": "explanation if query is ambiguous or non-search, else null"
}`
}

// Regex to extract semantic_search value from partial JSON as the stream arrives.
// Matches the string value (or null) immediately after the key.
const SEMANTIC_SEARCH_RE = /"semantic_search"\s*:\s*("(?:[^"\\]|\\.)*"|null)/

export async function interpretQuery(
  query: string,
  activeFilters?: import('./query.validate').QueryFilter[],
): Promise<{ plan: QueryPlan; embeddingPromise: Promise<number[]> | null }> {
  const errorFallback: QueryPlan = { ...DEFAULT_PLAN, semantic_search: query }

  // Lazily init the system-prompt cache on first LLM call.
  if (!cacheInitPromise) cacheInitPromise = initSystemPromptCache()
  await cacheInitPromise

  try {
    const stream = await ai.models.generateContentStream({
      model: QUERY_MODEL,
      contents: [{ role: 'user', parts: [{ text: buildUserPrompt(query, activeFilters) }] }],
      config: {
        ...(cachedSystemPromptName
          ? { cachedContent: cachedSystemPromptName }
          : { systemInstruction: SYSTEM_PROMPT }),
        responseMimeType: 'application/json',
        temperature: 0.0,
      },
    })

    let accumulated = ''
    let embeddingPromise: Promise<number[]> | null = null

    for await (const chunk of stream) {
      accumulated += chunk.text ?? ''

      // As soon as semantic_search is visible in the partial JSON, kick off the
      // embedding call in parallel — by the time the stream finishes and we have
      // the full plan, the embed is already inflight or done.
      if (!embeddingPromise) {
        const match = SEMANTIC_SEARCH_RE.exec(accumulated)
        if (match) {
          const raw = match[1]
          const semanticSearch = raw === 'null' ? null : JSON.parse(raw) as string
          if (semanticSearch) {
            embeddingPromise = embedText(semanticSearch)
          }
        }
      }
    }

    const parsed = tryParseJson(accumulated)
    if (parsed === null) return { plan: errorFallback, embeddingPromise: null }

    return { plan: validateQueryPlan(parsed), embeddingPromise }
  } catch {
    return { plan: errorFallback, embeddingPromise: null }
  }
}
