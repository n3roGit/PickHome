import { NextResponse } from "next/server";
import { getBackupJobSettingsView, listStoredBackups } from "@/lib/backup-jobs";
import { getSessionUser, isAdmin } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { resolvedDirectory } = await getBackupJobSettingsView();
    const files = await listStoredBackups(resolvedDirectory);
    return NextResponse.json({ files, directory: resolvedDirectory });
  } catch (err) {
    console.error("Backup list failed:", err);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}
