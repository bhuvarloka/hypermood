import { upload } from "@imagekit/next";
import { getUploadAuthParams } from "@imagekit/next/server";

export async function uploadToImageKit(
  file: File | Buffer,
  rollId: string,
  filename: string,
): Promise<string> {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error("ImageKit environment variables are not configured");
  }

  const { token, signature, expire } = getUploadAuthParams({
    publicKey,
    privateKey,
  });

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.\-]/g, "_");
  if (!sanitizedFilename) {
    throw new Error(`filename "${filename}" resolves to empty string after sanitization`);
  }

  const fileToUpload =
    file instanceof Buffer ? new Blob([new Uint8Array(file)]) : (file as File);

  const response = await upload({
    file: fileToUpload,
    fileName: sanitizedFilename,
    folder: `hypermood/rolls/${rollId}`,
    publicKey,
    token,
    signature,
    expire,
    useUniqueFileName: false,
  });

  if (!response.filePath) {
    throw new Error("ImageKit upload succeeded but returned no filePath");
  }

  // storage_key is the canonical path from ImageKit — never the full CDN URL
  return response.filePath;
}
