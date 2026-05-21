import { isLlmConfigured } from "@/lib/llm-client";
import {
  enrichListingFieldsWithLlm,
  mergeListingPreviewFields,
} from "@/lib/llm-listing-extract";
import {
  fetchListingPreview,
  finalizeListingPreviewFields,
  parseListingPlainText,
  type ListingPreviewFields,
  type ListingPreviewResult,
} from "@/lib/listing-import";

function listingFieldsPresent(fields: ListingPreviewFields): boolean {
  return Boolean(
    fields.title || fields.price || fields.sizeSqm || fields.address || fields.energyClass
  );
}

export type ApartmentListingImportInput = {
  listingUrl: string | null;
  pdfText: string;
};

/** Merge Inserat-URL preview with optional Exposé PDF into form-fill fields. */
export async function importApartmentListingFields(
  input: ApartmentListingImportInput
): Promise<ListingPreviewResult> {
  const { listingUrl, pdfText } = input;
  const warnings: string[] = [];
  let fields: ListingPreviewFields = {};
  let highlights: string | undefined;
  let llmUsed = false;

  if (listingUrl) {
    const urlResult = await fetchListingPreview(listingUrl);
    if (urlResult.ok) {
      fields = urlResult.fields;
      highlights = urlResult.highlights;
      llmUsed = urlResult.llmUsed ?? false;
      warnings.push(...urlResult.warnings);
    } else {
      warnings.push(...urlResult.warnings);
      if (!pdfText || pdfText.length < 80) {
        return urlResult;
      }
      warnings.push("Inserat-Seite nicht lesbar — versuche Exposé-PDF.");
    }
  }

  if (pdfText.length >= 80) {
    const llmConfigured = await isLlmConfigured();
    if (llmConfigured) {
      const pdfEnriched = await enrichListingFieldsWithLlm({}, pdfText);
      fields = mergeListingPreviewFields(fields, pdfEnriched.fields);
      if (pdfEnriched.llmUsed) {
        llmUsed = true;
        warnings.push("Felder aus Exposé-PDF per KI — bitte prüfen.");
      } else if (!listingFieldsPresent(pdfEnriched.fields)) {
        warnings.push("KI-Extraktion aus PDF fehlgeschlagen — nutze Text-Erkennung.");
        const pdfFields = parseListingPlainText(pdfText);
        fields = mergeListingPreviewFields(fields, pdfFields);
        if (listingFieldsPresent(pdfFields)) {
          warnings.push("Felder aus Exposé-PDF — bitte prüfen.");
        }
      }
      highlights = highlights ?? pdfEnriched.highlights;
    } else {
      const pdfFields = parseListingPlainText(pdfText);
      fields = mergeListingPreviewFields(fields, pdfFields);
      if (listingFieldsPresent(pdfFields)) {
        warnings.push("Felder aus Exposé-PDF — bitte prüfen.");
      }
    }
  }

  if (!listingFieldsPresent(fields)) {
    if (!listingUrl && pdfText.length < 80) {
      return {
        ok: false,
        error: "no_source",
        warnings: ["Bitte Inserat-URL eintragen oder ein indexiertes Exposé-PDF hochladen."],
      };
    }
    if (pdfText.length > 0 && pdfText.length < 80 && !listingUrl) {
      return {
        ok: false,
        error: "pdf_text_too_short",
        warnings: ["Exposé-Text zu kurz — PDF prüfen oder neu hochladen."],
      };
    }
    return {
      ok: false,
      error: "no_fields",
      warnings: ["Keine Felder erkannt — bitte manuell ausfüllen."],
    };
  }

  return {
    ok: true,
    fields: finalizeListingPreviewFields(fields, highlights),
    warnings,
    highlights,
    llmUsed,
  };
}
