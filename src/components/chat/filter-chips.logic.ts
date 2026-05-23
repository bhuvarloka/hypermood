import type { QueryFilter } from '@/lib/gemini/query'

/**
 * Maps internal field paths to plain English category names shown in chips.
 * Users should never see "objects[].label" — they should see "vase".
 */
const FIELD_LABELS: Record<string, string> = {
  'objects[].label': '',       // value speaks for itself: "vase", "car"
  'tags': '',                  // same — value is the label
  'colors.dominant_color_name': 'color',
  'colors.palette_mood': 'mood',
  'scene.setting': 'setting',
  'scene.time_of_day': 'time',
  'composition.framing': 'framing',
  'technical.orientation': 'orientation',
  'technical.is_screenshot': 'screenshot',
  'technical.is_graphic': 'graphic',
  'quality_score': 'quality',
  'people.count': 'people',
  'text_content.has_text': 'has text',
  'subject': 'subject',
  'description': '',
}

/**
 * Formats a QueryFilter into a natural language chip label.
 * Value-only for well-known fields (tags, object labels). Category prefix for the rest.
 */
export function formatChipLabel(filter: QueryFilter): string {
  const { field, operator, value } = filter

  const displayVal = Array.isArray(value)
    ? value.join(', ')
    : String(value)

  const category = FIELD_LABELS[field]

  // Fields where the value IS the label (tags, object labels, etc.)
  if (category === '') {
    if (operator === 'neq' || operator === 'lt' || operator === 'gt') {
      return `not ${displayVal}`
    }
    if (operator === 'gte') return `≥ ${displayVal}`
    if (operator === 'lte') return `≤ ${displayVal}`
    return displayVal
  }

  // people.count gets plain English labels instead of "people: 0" / "people ≥ 1"
  if (field === 'people.count') {
    if (operator === 'eq' && value === 0) return 'no people'
    if (operator === 'gte' && value === 1) return 'people'
    if (operator === 'gt' && value === 1) return 'group'
    if (operator === 'gte' && Number(value) >= 2) return `${value}+ people`
    if (operator === 'eq') return `${value} ${value === 1 ? 'person' : 'people'}`
    return `people: ${displayVal}`
  }

  // Fields with a category prefix: "color: turquoise"
  if (category !== undefined) {
    if (operator === 'neq') return `not ${category}: ${displayVal}`
    if (operator === 'gte') return `${category} ≥ ${displayVal}`
    if (operator === 'lte') return `${category} ≤ ${displayVal}`
    return `${category}: ${displayVal}`
  }

  // Fallback for unknown fields — use the last path segment
  const shortField = field.replace(/\[\]\./, '.').split('.').slice(-1)[0]
  return `${shortField}: ${displayVal}`
}
