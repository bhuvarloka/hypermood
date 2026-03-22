import { ai } from './parse-utils'

export const EMBEDDING_MODEL = 'gemini-embedding-2-preview'
export const EMBEDDING_MODEL_VERSION = EMBEDDING_MODEL

export async function embedImage(buffer: Buffer): Promise<number[]> {
  const mimeType = detectMimeType(buffer)
  const base64 = buffer.toString('base64')

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: {
      role: 'user',
      parts: [{ inlineData: { mimeType, data: base64 } }],
    },
  })

  const values = response.embeddings?.[0]?.values
  if (!values || values.length === 0) {
    throw new Error('Gemini embedding returned no values')
  }
  return values
}

export async function embedText(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  })

  const values = response.embeddings?.[0]?.values
  if (!values || values.length === 0) {
    throw new Error('Gemini embedding returned no values')
  }
  return values
}

function detectMimeType(buffer: Buffer): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg'
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return 'image/webp'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif'
  return 'image/jpeg'
}
