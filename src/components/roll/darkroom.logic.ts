/**
 * Formats a captured_at timestamp for display in the Darkroom metadata panel.
 * Returns null when the value is null/undefined/empty.
 *
 * Uses en-US locale with "Jan 1, 2024" format.
 */
export function formatCapturedDate(capturedAt: string | null | undefined): string | null {
  if (!capturedAt) return null
  const date = new Date(capturedAt)
  // Invalid dates (e.g. malformed EXIF strings) should degrade silently.
  if (isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
