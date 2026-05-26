import { NextResponse } from "next/server";
import type { ApartmentPdfVariant } from "@/lib/apartment-pdf-creator";
import { renderApartmentPdfBuffer } from "@/lib/apartment-pdf-render";
import { apartmentPdfFilename, loadApartmentPdfData } from "@/lib/apartment-pdf-data";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  req: Request,
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

  const raw = new URL(req.url).searchParams.get("variant");
  const variant: ApartmentPdfVariant = raw === "bank" ? "bank" : "full";

  const buffer = await renderApartmentPdfBuffer(data, { variant });
  const filename = apartmentPdfFilename(data.apartment.title, variant);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
