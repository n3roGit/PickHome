import { NextResponse } from "next/server";
import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { importBackupFromFile } from "@/lib/backup";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { getPickHomeDataDir } from "@/lib/pickhome-data";

export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("backup");
  const keepPrevious = formData.get("keepPrevious") === "1";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const backupsDir = join(getPickHomeDataDir(), "backups");
  const tempPath = join(backupsDir, `.upload-${Date.now()}.zip`);

  try {
    await mkdir(backupsDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempPath, buffer);
    await importBackupFromFile(tempPath, { keepPrevious });
    return NextResponse.json({ ok: true, restartRequired: true });
  } catch (err) {
    console.error("Backup import failed:", err);
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}
