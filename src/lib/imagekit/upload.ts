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

  const blob: Blob = Buffer.isBuffer(file) ? new Blob([new Uint8Array(file)]) : file;

  const form = new FormData();
  form.append("file", blob, sanitizedFilename);
  form.append("fileName", sanitizedFilename);
  form.append("folder", `hypermood/rolls/${rollId}`);
  form.append("publicKey", publicKey);
  form.append("token", token);
  form.append("signature", signature);
  form.append("expire", String(expire));
  form.append("useUniqueFileName", "false");

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    // Basic auth: privateKey as username, empty password
    headers: {
      Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ImageKit upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { filePath?: string };

  if (!data.filePath) {
    throw new Error("ImageKit upload succeeded but returned no filePath");
  }

  // storage_key is the canonical path from ImageKit — never the full CDN URL
  return data.filePath;
}

export async function deleteFromImageKit(storageKeys: string[]): Promise<void> {
  if (storageKeys.length === 0) return;

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) throw new Error("IMAGEKIT_PRIVATE_KEY is not configured");

  const auth = `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;

  await Promise.all(
    storageKeys.map(async (storageKey) => {
      // Resolve fileId from path via the search API
      const searchRes = await fetch(
        `https://api.imagekit.io/v1/files?name=${encodeURIComponent(storageKey.split("/").pop() ?? "")}&includeFolder=false`,
        { headers: { Authorization: auth } },
      );
      if (!searchRes.ok) return;

      const files = (await searchRes.json()) as Array<{ fileId: string; filePath: string }>;
      const match = files.find((f) => f.filePath === storageKey);
      if (!match) return;

      await fetch(`https://api.imagekit.io/v1/files/${match.fileId}`, {
        method: "DELETE",
        headers: { Authorization: auth },
      });
    }),
  );
}

export async function deleteFolderFromImageKit(folderPath: string): Promise<void> {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) throw new Error("IMAGEKIT_PRIVATE_KEY is not configured");

  const auth = `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;

  await fetch("https://api.imagekit.io/v1/folder", {
    method: "DELETE",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ folderPath }),
  });
}
