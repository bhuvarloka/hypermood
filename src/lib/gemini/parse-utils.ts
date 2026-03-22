import { GoogleGenAI } from '@google/genai'

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch {
    // Attempt repair: trim, strip markdown fences, remove control chars
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
      .trim()

    try {
      return JSON.parse(cleaned)
    } catch {
      return null
    }
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}
