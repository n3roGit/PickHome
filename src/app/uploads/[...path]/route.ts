import { readFile, stat } from "fs/promises";
import { isAbsolute, join, relative, resolve } from "path";
import { NextRequest, NextResponse } from "next/server";
import { getUploadsRoot } from "@/lib/pickhome-data";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
};

function safePath(segments: string[]) {
  const root = resolve(getUploadsRoot());
  const file = resolve(root, ...segments);
  const rel = relative(root, file);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    return null;
  }
  return file;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const filePath = safePath(resolvedParams.path);
  if (!filePath) {
    return new NextResponse(null, { status: 400 });
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      return new NextResponse(null, { status: 404 });
    }
    const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
    const type = MIME[ext] ?? "application/octet-stream";
    const body = await readFile(filePath);
    return new NextResponse(body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
