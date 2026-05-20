import { NextResponse } from "next/server";
import { runBackupJob } from "@/lib/backup-jobs";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const maxDuration = 120;

export async function POST() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await runBackupJob({ force: true });
    return NextResponse.json({
      ok: true,
      fileName: result.fileName,
      removed: result.removed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "run_failed";
    console.error("Manual backup run failed:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
