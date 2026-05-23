import { asRecord } from './parse-utils'
import type {
  BaseLayerMetadata,
  DetectedObject,
  ObjectProminence,
} from '@/types/domain'

export const DEFAULTS: BaseLayerMetadata = {
  subject: 'unknown image',
  objects: [],
  people: { count: 0 },
  colors: { dominant: [], palette_mood: 'neutral', dominant_color_name: 'unknown' },
  scene: { setting: 'not applicable', time_of_day: 'unknown' },
  composition: { framing: 'medium shot' },
  technical: { is_screenshot: false, is_graphic: false, orientation: 'landscape' },
  quality_score: 0.5,
  text_content: { has_text: false, text_strings: [], text_role: 'none' },
  description: '',
  tags: [],
}

export function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

export function ensureString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

export function ensureBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function validateObject(raw: unknown): DetectedObject | null {
  const obj = asRecord(raw)
  if (!obj || typeof obj.label !== 'string' || obj.label.length === 0) return null
  return {
    label: obj.label,
    prominence: (['primary', 'secondary', 'background'].includes(obj.prominence as string)
      ? obj.prominence as ObjectProminence
      : 'secondary'),
  }
}

export function validateMetadata(raw: unknown): BaseLayerMetadata {
  const data = asRecord(raw)
  if (!data) return { ...DEFAULTS }

  const objects = Array.isArray(data.objects)
    ? data.objects.map(validateObject).filter((o): o is DetectedObject => o !== null)
    : DEFAULTS.objects

  const peopleRaw = asRecord(data.people)
  const colorsRaw = asRecord(data.colors)
  const sceneRaw = asRecord(data.scene)
  const compRaw = asRecord(data.composition)
  const techRaw = asRecord(data.technical)
  const textRaw = asRecord(data.text_content)

  return {
    subject: ensureString(data.subject, DEFAULTS.subject),
    objects,
    people: {
      count: typeof peopleRaw?.count === 'number' ? peopleRaw.count : 0,
    },
    colors: {
      dominant: colorsRaw ? ensureStringArray(colorsRaw.dominant) : DEFAULTS.colors.dominant,
      palette_mood: ensureString(colorsRaw?.palette_mood, DEFAULTS.colors.palette_mood) as BaseLayerMetadata['colors']['palette_mood'],
      dominant_color_name: ensureString(colorsRaw?.dominant_color_name, DEFAULTS.colors.dominant_color_name),
    },
    scene: {
      setting: ensureString(sceneRaw?.setting, DEFAULTS.scene.setting) as BaseLayerMetadata['scene']['setting'],
      time_of_day: ensureString(sceneRaw?.time_of_day, DEFAULTS.scene.time_of_day) as BaseLayerMetadata['scene']['time_of_day'],
    },
    composition: {
      framing: ensureString(compRaw?.framing, DEFAULTS.composition.framing) as BaseLayerMetadata['composition']['framing'],
    },
    technical: {
      is_screenshot: ensureBool(techRaw?.is_screenshot, DEFAULTS.technical.is_screenshot),
      is_graphic: ensureBool(techRaw?.is_graphic, DEFAULTS.technical.is_graphic),
      orientation: ensureString(techRaw?.orientation, DEFAULTS.technical.orientation) as BaseLayerMetadata['technical']['orientation'],
    },
    quality_score: clamp(data.quality_score, 0, 1, DEFAULTS.quality_score),
    text_content: {
      has_text: ensureBool(textRaw?.has_text, DEFAULTS.text_content.has_text),
      text_strings: textRaw ? ensureStringArray(textRaw.text_strings) : DEFAULTS.text_content.text_strings,
      text_role: ensureString(textRaw?.text_role, DEFAULTS.text_content.text_role) as BaseLayerMetadata['text_content']['text_role'],
    },
    description: ensureString(data.description, DEFAULTS.description),
    tags: ensureStringArray(data.tags).map(t => t.toLowerCase()),
  }
}

export function detectMimeType(buffer: Buffer): string {
  if (buffer.length < 2) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif'
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return 'image/webp'
  return 'image/jpeg'
}
