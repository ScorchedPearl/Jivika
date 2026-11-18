import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { LOCAL_UPLOAD_DIR, MIME_BY_EXT, isSafeName } from "@/lib/local-storage";

// Serves images stored by the local-storage fallback of /api/upload.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!isSafeName(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const data = await fs.readFile(path.join(LOCAL_UPLOAD_DIR, name));
    const ext = name.split(".").pop()!.toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
