import { NextResponse } from "next/server";
import { restoreStoredBackup } from "@/lib/backup-jobs";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const maxDuration = 120;

type RouteParams = { params: Promise<{ name: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { name } = await params;
  const fileName = decodeURIComponent(name);

  let keepPrevious = false;
  try {
    const body = (await req.json()) as { keepPrevious?: boolean };
    keepPrevious = Boolean(body.keepPrevious);
  } catch {
    // no body is fine
  }

  try {
    await restoreStoredBackup(fileName, { keepPrevious });
    return NextResponse.json({ ok: true, restartRequired: true });
  } catch (err) {
    console.error("Backup restore failed:", err);
    const message = err instanceof Error ? err.message : "restore_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
