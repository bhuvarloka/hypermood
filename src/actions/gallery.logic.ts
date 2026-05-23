/**
 * Pure slug-generation logic shared by createGallery / updateGallery.
 * Extracted so it can be unit tested without touching Supabase.
 */

/**
 * Converts a gallery name to a URL-safe slug.
 * Rules:
 *  - Lowercased and trimmed
 *  - Non-alphanumeric chars (except spaces and existing hyphens) stripped
 *  - Spaces collapsed to a single hyphen
 *  - Consecutive hyphens collapsed to one
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/**
 * Given the stagger index of an image in a grid, returns the CSS animation
 * delay in milliseconds (capped at 600ms so the last images don't wait forever).
 */
export function staggerDelay(index: number): number {
  return Math.min(index * 30, 600)
}

import { pluralize } from '@/lib/format'

export function pluralImages(count: number): string {
  return pluralize(count, 'image')
}
