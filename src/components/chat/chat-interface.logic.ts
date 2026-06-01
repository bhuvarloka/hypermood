import type { Image as ImageRecord } from "@/types/domain";

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
  selectedImageIds: string[];
  resultImageIds: string[] | null;
  liveImages: ImageRecord[];
  imageMap: Map<string, ImageRecord>;
}): ImageRecord[] {
  const { selectedImageIds, resultImageIds, liveImages, imageMap } = opts;

  if (selectedImageIds.length > 0) {
    return selectedImageIds.flatMap((id) => {
      const img = imageMap.get(id);
      return img ? [img] : [];
    });
  }

  if (resultImageIds !== null && resultImageIds.length > 0) {
    return resultImageIds.flatMap((id) => {
      const img = imageMap.get(id);
      return img ? [img] : [];
    });
  }

  return liveImages;
}
