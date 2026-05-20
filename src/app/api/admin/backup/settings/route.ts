import { NextResponse } from "next/server";
import {
  getBackupJobSettingsView,
  updateBackupJobSettings,
  type BackupJobSettingsInput,
} from "@/lib/backup-jobs";
import { getSessionUser, isAdmin } from "@/lib/auth";

async function requireAdminUser() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) return null;
  return user;
}

export async function GET() {
  if (!(await requireAdminUser())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const settings = await getBackupJobSettingsView();
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("Backup settings read failed:", err);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!(await requireAdminUser())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: Partial<BackupJobSettingsInput>;
  try {
    body = (await req.json()) as Partial<BackupJobSettingsInput>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input: BackupJobSettingsInput = {
    enabled: Boolean(body.enabled),
    hour: Number(body.hour),
    minute: Number(body.minute),
    retainCount: Number(body.retainCount),
    directory: String(body.directory ?? ""),
  };

  try {
    await updateBackupJobSettings(input);
    const settings = await getBackupJobSettingsView();
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
