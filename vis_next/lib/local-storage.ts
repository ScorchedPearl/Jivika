import { promises as fs } from "fs";
import path from "path";

/** Local-disk image store used when S3 is unavailable (e.g. local dev without valid AWS keys). */
export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".uploads");

export const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export async function saveLocal(name: string, data: Buffer): Promise<void> {
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, name), data);
}

/** Only flat, generated names are allowed — never paths. */
export function isSafeName(name: string): boolean {
  return /^[a-f0-9-]{36}\.(jpg|jpeg|png|gif|webp)$/i.test(name);
}
