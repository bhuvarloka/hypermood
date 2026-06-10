import { buildSrc } from "@imagekit/next";

export type ImageTransforms = {
  width?: number;
  height?: number;
  quality?: number;
  format?: "auto" | "webp" | "jpg" | "png" | "avif";
  blur?: number;
};

export function getImageUrl(
  storageKey: string,
  transforms?: ImageTransforms,
): string {
  const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

  if (!urlEndpoint) {
    throw new Error("NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT is not configured");
  }

  return buildSrc({
    urlEndpoint,
    src: storageKey,
    transformation: transforms
      ? [
          {
            width: transforms.width,
            height: transforms.height,
            quality: transforms.quality,
            format: transforms.format,
            blur: transforms.blur,
          },
        ]
      : undefined,
  });
}

export function getLqipUrl(storageKey: string): string {
  return getImageUrl(storageKey, { width: 16, blur: 10, quality: 20 });
}
