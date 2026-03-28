/**
 * Builds the ordered list of processing lines shown in ProcessingIndicator.
 *
 * For text queries: "Interpreting query…" → "Searching N images…"
 * For image-as-prompt: "Computing visual similarity…" → "Blending with text prompt…"
 * Once matchCount is defined, appends the terminal "Found M match(es)" line.
 */
export function buildLines(opts: {
  isImagePrompt: boolean
  imageCount: number
  matchCount?: number
}): string[] {
  const base = opts.isImagePrompt
    ? ['Computing visual similarity...', 'Blending with text prompt...']
    : ['Interpreting query...', `Searching ${opts.imageCount.toLocaleString()} images...`]

  return opts.matchCount !== undefined
    ? [...base, `Found ${opts.matchCount.toLocaleString()} match${opts.matchCount === 1 ? '' : 'es'}`]
    : base
}
