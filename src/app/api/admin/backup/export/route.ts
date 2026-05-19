import { NextResponse } from "next/server";
import { exportBackupFileName, exportBackupToBuffer } from "@/lib/backup";
import { getSessionUser, isAdmin } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const buffer = await exportBackupToBuffer();
    const filename = exportBackupFileName();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Backup export failed:", err);
    return new NextResponse("Export failed", { status: 500 });
  }
}
