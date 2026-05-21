import { NextResponse } from "next/server";
import { getApartmentLlmBundle, loadApartmentPdfSourceText } from "@/lib/apartment-llm-data";
import { importApartmentListingFields } from "@/lib/apartment-listing-import";
import { getSessionUser } from "@/lib/auth";
import { normalizeListingUrl } from "@/lib/listing-url";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ apartmentId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { apartmentId } = await params;
  const bundle = await getApartmentLlmBundle(apartmentId, user);
  if (!bundle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    body = {};
  }

  const urlFromBody = String(body.url ?? "").trim();
  const listingUrl =
    normalizeListingUrl(urlFromBody) ??
    (bundle.apartment.listingUrl ? normalizeListingUrl(bundle.apartment.listingUrl) : null);

  const pdfText = await loadApartmentPdfSourceText(bundle.pdfDocuments);
  const result = await importApartmentListingFields({ listingUrl, pdfText });

  if (!result.ok) {
    const status =
      result.error === "llm_not_configured"
        ? 503
        : result.error === "invalid_url"
          ? 400
          : 422;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({
    ok: true,
    fields: result.fields,
    warnings: result.warnings,
    highlights: result.highlights,
    llmUsed: result.llmUsed,
  });
}
