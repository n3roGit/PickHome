import { NextResponse } from "next/server";
import { getAppTimeZone, updateAppTimeZone } from "@/lib/app-settings";
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
    const timeZone = await getAppTimeZone();
    return NextResponse.json({ timeZone });
  } catch (err) {
    console.error("Timezone settings read failed:", err);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!(await requireAdminUser())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: { timeZone?: string };
  try {
    body = (await req.json()) as { timeZone?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const timeZone = String(body.timeZone ?? "").trim();
  if (!timeZone) {
    return NextResponse.json({ error: "invalid_timezone" }, { status: 400 });
  }

  try {
    const saved = await updateAppTimeZone(timeZone);
    return NextResponse.json({ timeZone: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "update_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
