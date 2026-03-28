/**
 * Pure indexing-status derivation for RollCard.
 * Three mutually-exclusive states based on image_count vs indexed_count.
 */
export type IndexingStatus = 'empty' | 'pending' | 'indexing' | 'complete'

export function deriveIndexingStatus(imageCount: number, indexedCount: number): IndexingStatus {
  if (imageCount === 0) return 'empty'
  if (indexedCount === 0) return 'pending'
  if (indexedCount < imageCount) return 'indexing'
  return 'complete'
}

/**
 * Builds a 4-slot array for the 2×2 thumbnail mosaic.
 * Slots beyond the provided keys are null (renders a placeholder).
 */
export function buildSlots<T>(items: T[], count = 4): (T | null)[] {
  return Array.from({ length: count }, (_, i) => items[i] ?? null)
}
