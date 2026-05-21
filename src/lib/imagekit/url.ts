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

  const base = urlEndpoint.replace(/\/$/, "") + storageKey;

  if (!transforms) return base;

  const parts: string[] = [];
  if (transforms.width) parts.push(`w-${transforms.width}`);
  if (transforms.height) parts.push(`h-${transforms.height}`);
  if (transforms.quality) parts.push(`q-${transforms.quality}`);
  if (transforms.format) parts.push(`f-${transforms.format}`);
  if (transforms.blur) parts.push(`bl-${transforms.blur}`);

  return parts.length > 0 ? `${base}?tr=${parts.join(",")}` : base;
}

export function getLqipUrl(storageKey: string): string {
  return getImageUrl(storageKey, { width: 16, blur: 10, quality: 20 });
}
