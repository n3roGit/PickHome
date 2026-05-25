import { NextResponse } from "next/server";
import { renderApartmentPdfBuffer } from "@/lib/apartment-pdf-render";
import { apartmentPdfFilename, loadApartmentPdfData } from "@/lib/apartment-pdf-data";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ apartmentId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { apartmentId } = await params;
  const data = await loadApartmentPdfData(apartmentId, user);
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buffer = await renderApartmentPdfBuffer(data);
  const filename = apartmentPdfFilename(data.apartment.title);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
