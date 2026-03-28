import { GoogleGenAI } from '@google/genai'

export const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

export function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw)
  } catch {
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
  if (Array.isArray(value) || typeof value !== 'object' || value === null) return null
  return value as Record<string, unknown>
}
