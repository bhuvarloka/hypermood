/**
 * Returns the uppercased first character of an email for the avatar.
 * Falls back to '?' for empty strings.
 */
export function getInitial(email: string): string {
  return email[0]?.toUpperCase() ?? '?'
}

/**
 * Builds a fixed-length slot array for the micro-preview grid.
 * Keys beyond the provided list become null (placeholder cell).
 */
export function buildPreviewSlots(storageKeys: string[], count = 4): (string | null)[] {
  return Array.from({ length: count }, (_, i) => storageKeys[i] ?? null)
}
