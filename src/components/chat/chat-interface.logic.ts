import type { Image as ImageRecord } from '@/types/domain'

/**
 * Regular expression that matches user messages intending to open the gallery
 * manager drawer rather than query the image roll.
 *
 * Matches "gallery" (singular) or "galleries" (plural).
 * Note: `galleries?` would match "gallerie" or "galleries" but NOT "gallery".
 * The correct pattern is `gallery(?:s|\b)` to match both forms.
 */
export const GALLERY_INTENT_RE = /\b(show|open|view|see|list)\b.*\bgaller(?:y|ies)\b/i

/**
 * Derives the ordered list of images to show in PreviewPanel / the selection
 * strip, following the priority rules:
 *
 *  1. Explicit selection — user has hand-picked images (beats everything)
 *  2. Result set       — last query returned a filtered subset
 *  3. Full roll        — no query has run yet, show everything
 *
 * Images missing from imageMap (e.g. uploaded after the map was built) are
 * silently skipped rather than crashing.
 */
export function derivePreviewImages(opts: {
  selectedImageIds: string[]
  resultImageIds: string[] | null
  liveImages: ImageRecord[]
  imageMap: Map<string, ImageRecord>
}): ImageRecord[] {
  const { selectedImageIds, resultImageIds, liveImages, imageMap } = opts

  if (selectedImageIds.length > 0) {
    return selectedImageIds.flatMap((id) => {
      const img = imageMap.get(id)
      return img ? [img] : []
    })
  }

  if (resultImageIds !== null && resultImageIds.length > 0) {
    return resultImageIds.flatMap((id) => {
      const img = imageMap.get(id)
      return img ? [img] : []
    })
  }

  return liveImages
}
