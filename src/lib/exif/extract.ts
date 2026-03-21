import { parse } from "exifr";

export type ExifData = {
  capturedAt: Date | null;
  width: number | null;
  height: number | null;
};

export async function extractExif(buffer: Buffer): Promise<ExifData> {
  try {
    const tags = await parse(buffer, {
      pick: ["DateTimeOriginal", "ExifImageWidth", "ExifImageHeight"],
      reviveValues: true,
    });

    if (!tags) {
      return { capturedAt: null, width: null, height: null };
    }

    return {
      capturedAt: tags.DateTimeOriginal instanceof Date ? tags.DateTimeOriginal : null,
      width: typeof tags.ExifImageWidth === "number" ? tags.ExifImageWidth : null,
      height: typeof tags.ExifImageHeight === "number" ? tags.ExifImageHeight : null,
    };
  } catch {
    // malformed or missing EXIF — safe to ignore
    return { capturedAt: null, width: null, height: null };
  }
}
