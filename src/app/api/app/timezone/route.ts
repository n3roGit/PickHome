import { NextResponse } from "next/server";
import { getAppTimeZone } from "@/lib/app-settings";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const timeZone = await getAppTimeZone();
    return NextResponse.json({ timeZone });
  } catch (err) {
    console.error("App timezone read failed:", err);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}
