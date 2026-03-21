import { buildSrc } from "@imagekit/next";
import type { Transformation } from "@imagekit/next";

export type ImageTransforms = {
  width?: number;
  height?: number;
  quality?: number;
  format?: "auto" | "webp" | "jpg" | "png" | "avif";
};

export function getImageUrl(
  storageKey: string,
  transforms?: ImageTransforms,
): string {
  const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

  if (!urlEndpoint) {
    throw new Error("NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT is not configured");
  }

  const transformation: Transformation[] | undefined = transforms
    ? [{ width: transforms.width, height: transforms.height, quality: transforms.quality, format: transforms.format }]
    : undefined;

  return buildSrc({ urlEndpoint, src: storageKey, transformation });
}
