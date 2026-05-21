import { NextResponse } from "next/server";
import { getApartmentLlmBundle, loadApartmentPdfSourceText } from "@/lib/apartment-llm-data";
import { getSessionUser } from "@/lib/auth";
import { isLlmConfigured } from "@/lib/llm-client";
import {
  enrichListingFieldsWithLlm,
  htmlToListingSourceText,
} from "@/lib/llm-listing-extract";
import { parseListingHtml, type ListingPreviewFields } from "@/lib/listing-import";
import { fetchExternal } from "@/lib/external-fetch";
import { normalizeListingUrl } from "@/lib/listing-url";

function listingFieldsPresent(fields: ListingPreviewFields): boolean {
  return Boolean(
    fields.title || fields.price || fields.sizeSqm || fields.address || fields.energyClass
  );
}

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

  if (!(await isLlmConfigured())) {
    return NextResponse.json({ error: "llm_not_configured" }, { status: 503 });
  }

  let body: { source?: string };
  try {
    body = (await req.json()) as { source?: string };
  } catch {
    body = {};
  }

  const warnings: string[] = [];
  let fields: ListingPreviewFields = {};
  let llmUsed = false;
  let highlights: string | undefined;

  const pdfText = await loadApartmentPdfSourceText(bundle.pdfDocuments);
  const preferPdf = body.source === "pdf" || pdfText.length >= 80;
  const listingUrl = bundle.apartment.listingUrl
    ? normalizeListingUrl(bundle.apartment.listingUrl)
    : null;

  if (preferPdf && pdfText.length >= 80) {
    const enriched = await enrichListingFieldsWithLlm({}, pdfText);
    fields = enriched.fields;
    llmUsed = enriched.llmUsed;
    highlights = enriched.highlights;
    if (llmUsed) warnings.push("Felder aus Exposé-PDF per KI — bitte prüfen.");
    else if (listingUrl) {
      warnings.push("KI-Extraktion aus PDF fehlgeschlagen — versuche Inserat-URL.");
    }
  }

  if (!listingFieldsPresent(fields) && listingUrl) {
    const res = await fetchExternal("listing", listingUrl, {
      headers: {
        "User-Agent": "PickHome/1.0 (listing extract)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res?.ok) {
      return NextResponse.json(
        { error: "fetch_failed", warnings: ["Inserat nicht lesbar."] },
        { status: 422 }
      );
    }
    const html = await res.text();
    fields = parseListingHtml(html);
    const enriched = await enrichListingFieldsWithLlm(fields, htmlToListingSourceText(html));
    fields = enriched.fields;
    llmUsed = enriched.llmUsed || llmUsed;
    highlights = highlights ?? enriched.highlights;
    if (enriched.llmUsed) warnings.push("Felder per KI ergänzt — bitte prüfen.");
  }

  if (!listingFieldsPresent(fields)) {
    if (body.source === "pdf" && pdfText.length === 0) {
      return NextResponse.json(
        {
          error: "pdf_text_missing",
          warnings: ["Exposé-PDF ohne Text — Datei prüfen oder neu hochladen."],
        },
        { status: 422 }
      );
    }
    if (body.source === "pdf" && pdfText.length > 0 && pdfText.length < 80) {
      return NextResponse.json(
        { error: "pdf_text_too_short", warnings: ["Exposé-Text zu kurz."] },
        { status: 422 }
      );
    }
    if (!listingUrl && pdfText.length < 80) {
      return NextResponse.json(
        {
          error: "no_source",
          warnings: ["Kein Exposé-Text und keine Inserat-URL vorhanden."],
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "no_fields", warnings: ["Keine Felder erkannt."] },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true, fields, warnings, highlights, llmUsed });
}
