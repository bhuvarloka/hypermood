import type { QueryPlan } from './query.validate'
import { DEFAULT_PLAN } from './query.validate'

type FastPathResult = { plan: QueryPlan; matched: string } | null

// Pattern entries: [name, regex, plan-builder]
type PatternEntry = {
  name: string
  test: RegExp
  build: (query: string) => Partial<QueryPlan>
}

const PATTERNS: PatternEntry[] = [
  {
    name: 'portraits',
    test: /\b(portrait|portraits|faces?|headshot|close.?up of (a )?(person|people|man|woman|girl|boy))\b/i,
    build: () => ({
      filters: [
        { field: 'people.count', operator: 'gte', value: 1 },
        { field: 'composition.framing', operator: 'in', value: ['close-up', 'medium close-up', 'extreme close-up'] },
      ],
      semantic_search: 'portrait close-up face',
      followups: ['Only outdoors', 'With golden hour lighting'],
    }),
  },
  {
    name: 'golden_hour',
    test: /\b(golden hour|sunset|sunrise|dusk|dawn|magic hour)\b/i,
    build: (q) => ({
      filters: [
        {
          field: 'scene.time_of_day',
          operator: 'in',
          value: /dawn|sunrise/i.test(q)
            ? ['dawn', 'golden hour']
            : ['golden hour', 'sunset', 'dusk'],
        },
      ],
      semantic_search: q,
      followups: ['Only outdoors', 'Without people'],
    }),
  },
  {
    name: 'outdoor',
    test: /\b(outdoor|outside|exterior|nature|open air)\b/i,
    build: () => ({
      filters: [{ field: 'scene.setting', operator: 'eq', value: 'outdoor' }],
      semantic_search: null,
      followups: ['Golden hour only', 'Without people'],
    }),
  },
  {
    name: 'indoor',
    test: /\b(indoor|inside|interior)\b/i,
    build: () => ({
      filters: [{ field: 'scene.setting', operator: 'eq', value: 'indoor' }],
      semantic_search: null,
      followups: ['With people', 'Evening lighting'],
    }),
  },
  {
    name: 'with_people',
    test: /\b(with (a )?(person|people|someone|man|woman|human|crowd)|contains? (a )?(person|people|human)|has (a )?(person|people))\b/i,
    build: () => ({
      filters: [{ field: 'people.count', operator: 'gte', value: 1 }],
      semantic_search: null,
      followups: ['Close-up portraits', 'Outdoors only'],
    }),
  },
  {
    name: 'no_people',
    test: /\b(no people|without (a )?(person|people|human)|no (one|humans?|persons?)|empty (scenes?|shots?)|landscapes? without)\b/i,
    build: () => ({
      filters: [{ field: 'people.count', operator: 'eq', value: 0 }],
      semantic_search: null,
      followups: ['Outdoors only', 'Golden hour'],
    }),
  },
  {
    name: 'screenshots',
    test: /\b(screenshots?|screen (capture|grab|shot)|ui|app (screen|interface))\b/i,
    build: () => ({
      filters: [{ field: 'technical.is_screenshot', operator: 'eq', value: true }],
      semantic_search: null,
      followups: ['With text', 'Mobile screens'],
    }),
  },
  {
    name: 'graphics',
    test: /\b(graphics?|illustrations?|drawings?|artwork|design|poster|infographic)\b/i,
    build: () => ({
      filters: [{ field: 'technical.is_graphic', operator: 'eq', value: true }],
      semantic_search: null,
      followups: ['With text', 'Screenshots only'],
    }),
  },
  {
    name: 'recent',
    test: /\b(recent|latest|newest|last (few|uploaded)|most recent)\b/i,
    build: () => ({
      filters: [],
      semantic_search: null,
      sort: { field: 'uploaded_at', direction: 'desc' as const },
      limit: 20,
      followups: ['Only outdoors', 'With people'],
    }),
  },
  {
    name: 'high_quality',
    test: /\b(best|highest quality|sharpest|clearest|professional|top quality|hi.?res)\b/i,
    build: () => ({
      filters: [{ field: 'quality_score', operator: 'gte', value: 0.75 }],
      sort: { field: 'quality_score', direction: 'desc' as const },
      semantic_search: null,
      followups: ['Outdoors only', 'Portraits'],
    }),
  },
  {
    name: 'low_quality',
    test: /\b(blurry|blurred|out.?of.?focus|dark|underexposed|overexposed|low quality|poor quality)\b/i,
    build: () => ({
      filters: [{ field: 'quality_score', operator: 'lte', value: 0.35 }],
      sort: { field: 'quality_score', direction: 'asc' as const },
      semantic_search: null,
      followups: ['Only the sharpest shots'],
    }),
  },
  {
    name: 'has_text',
    test: /\b(with text|contains? text|has (some )?text|text (in|on) (it|them|the image)|readable text|signage|labels?|captions?)\b/i,
    build: () => ({
      filters: [{ field: 'text_content.has_text', operator: 'eq', value: true }],
      semantic_search: null,
      followups: ['Screenshots only', 'Graphics'],
    }),
  },
]

// Single-word queries skip the LLM: direct tag containment + semantic search.
const SINGLE_TAG_RE = /^[a-z0-9\-_]{2,30}$/i

export function tryFastPath(query: string): FastPathResult {
  const q = query.trim()
  if (!q) return null

  for (const { name, test, build } of PATTERNS) {
    if (test.test(q)) {
      const plan: QueryPlan = {
        ...DEFAULT_PLAN,
        followups: [],
        ...build(q),
      }
      return { plan, matched: name }
    }
  }

  // Single-word / single-tag query: direct tag + semantic search
  if (SINGLE_TAG_RE.test(q)) {
    return {
      plan: {
        ...DEFAULT_PLAN,
        filters: [{ field: 'tags', operator: 'contains', value: q.toLowerCase() }],
        semantic_search: q,
        followups: [],
      },
      matched: 'single_tag',
    }
  }

  return null
}
