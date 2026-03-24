import { ai, tryParseJson } from './parse-utils'
import { validateQueryPlan, DEFAULT_PLAN } from './query.validate'
import type { ChatMessage } from '@/types/domain'

const QUERY_MODEL = process.env.GEMINI_QUERY_MODEL ?? 'gemini-3-flash-preview'

// Re-export types so existing imports from '@/lib/gemini/query' continue to work.
export type { FilterOperator, QueryFilter, QuerySort, QueryPlan } from './query.validate'

const SYSTEM_PROMPT = `You are a query interpreter for a semantic image search engine. Your job is to translate natural language queries into a structured JSON query plan that the system will use to filter and rank images.

You have access to the following indexed metadata for each image. All fields are nested under a "metadata" JSONB column, accessed with dot notation (e.g., "scene.setting", "technical.is_screenshot").

AVAILABLE FIELDS AND THEIR TYPES:

subject (string): One-phrase description of what the image is fundamentally about.

objects (array of objects):
  - objects[].label (string): what the object is — e.g., "cat", "laptop", "car"
  - objects[].prominence (string): "primary" | "secondary" | "background"
  - objects[].position (string): "center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right"
  - objects[].attributes (string[]): visual attributes like "red", "wooden", "small"

people.count (number): number of people visible
people.descriptions[].position (string): position in frame — "center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right"
people.descriptions[].age_range (string): "child" | "teenager" | "young adult" | "middle-aged" | "elderly" | "unknown"
people.descriptions[].gender_presentation (string): "masculine" | "feminine" | "ambiguous"
people.descriptions[].clothing (string[]): clothing items worn — e.g., "red jacket", "suit", "white dress"
people.descriptions[].activity (string): what they appear to be doing
people.descriptions[].expression (string): facial expression

relationships (string[]): spatial/contextual relationships between elements — e.g., "cat sitting on person's lap"

colors.dominant (string[]): top hex color codes
colors.palette_mood (string): "warm" | "cool" | "neutral" | "mixed" | "monochromatic" | "vibrant" | "muted" | "pastel" | "dark" | "high-contrast"
colors.dominant_color_name (string): plain English name of most dominant color

scene.environment (string): specific scene type — e.g., "beach", "office", "kitchen"
scene.setting (string): "indoor" | "outdoor" | "mixed" | "not applicable"
scene.time_of_day (string): "dawn" | "morning" | "midday" | "afternoon" | "golden hour" | "sunset" | "dusk" | "night" | "artificial lighting" | "unknown"
scene.weather (string): "clear" | "cloudy" | "overcast" | "rainy" | "snowy" | "foggy" | "not applicable" | "unknown"

mood.emotional_tone (string): e.g., "joyful", "serene", "tense", "melancholic"
mood.energy_level (number 0–1): 0 = still/calm, 1 = dynamic/energetic
mood.aesthetic_style (string): e.g., "minimalist", "cinematic", "vintage", "documentary"

composition.framing (string): "extreme close-up" | "close-up" | "medium close-up" | "medium shot" | "medium wide" | "wide shot" | "extreme wide" | "overhead" | "birds-eye" | "flat lay"
composition.focal_point (string): what the eye is drawn to
composition.symmetry (string): "symmetric" | "asymmetric" | "radial" | "pattern/repetition"
composition.depth (string): "shallow (blurred background)" | "deep (all in focus)" | "layered (foreground/midground/background)" | "flat (2D/graphic)"

technical.blur_score (number 0–1): 0 = sharp, 1 = very blurry
technical.exposure (string): "underexposed" | "well-exposed" | "overexposed" | "mixed/HDR"
technical.noise_level (string): "clean" | "slight grain" | "noisy" | "very noisy"
technical.is_screenshot (boolean)
technical.is_graphic (boolean)
technical.orientation (string): "landscape" | "portrait" | "square"

quality_score (number 0–1): overall image quality — 0 = unusable, 1 = professional
texture_material (string[]): materials visible — e.g., "wood", "glass", "concrete"

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
3. For queries about specific objects or labels, use "contains" on "objects" (field: "objects[].label").
4. For tags, use "contains" on "tags".
5. For text in images, use "contains" on "text_content.text_strings".
6. For clothing queries, use "contains" on "people.descriptions[].clothing".
7. Keep filters minimal — only add what was explicitly or strongly implied by the query. Over-filtering excludes relevant results.
8. limit: default 50, max 200. Increase for "show me all" style requests.
9. For greetings, questions about the system, or completely non-search messages: return filters=[], semantic_search=null, sort=null, limit=50, and explain in clarification_note.
10. For ambiguous queries: return your best-effort plan AND set clarification_note explaining what you assumed.

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation. Just the JSON.`

function buildUserPrompt(query: string, chatHistory: ChatMessage[]): string {
  const historyContext = chatHistory.length > 0
    ? `Recent conversation (most recent last):\n${
        chatHistory
          .slice(-8)
          .map(m => `${m.role}: ${m.content}`)
          .join('\n')
      }\n\n`
    : ''

  return `${historyContext}Current query: "${query}"

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

export async function interpretQuery(
  query: string,
  chatHistory: ChatMessage[],
): Promise<QueryPlan> {
  // On any failure, degrade to pure semantic search so chat always returns results
  const errorFallback: QueryPlan = { ...DEFAULT_PLAN, semantic_search: query }

  try {
    const response = await ai.models.generateContent({
      model: QUERY_MODEL,
      contents: [{ role: 'user', parts: [{ text: buildUserPrompt(query, chatHistory) }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.0,
      },
    })

    const text = response.text
    if (!text) return errorFallback

    const parsed = tryParseJson(text)
    if (parsed === null) return errorFallback

    return validateQueryPlan(parsed)
  } catch {
    return errorFallback
  }
}
