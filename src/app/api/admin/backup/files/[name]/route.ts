import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import {
  deleteStoredBackup,
  getBackupJobSettingsView,
  resolveBackupFilePath,
} from "@/lib/backup-jobs";
import { getSessionUser, isAdmin } from "@/lib/auth";

type RouteParams = { params: Promise<{ name: string }> };

export async function DELETE(_req: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { name } = await params;
  const fileName = decodeURIComponent(name);

  try {
    await deleteStoredBackup(fileName);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "delete_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(_req: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { name } = await params;
  const fileName = decodeURIComponent(name);

  try {
    const { resolvedDirectory } = await getBackupJobSettingsView();
    const filePath = resolveBackupFilePath(resolvedDirectory, fileName);
    const buffer = await readFile(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Backup download failed:", err);
    return new NextResponse("Download failed", { status: 400 });
  }
}
