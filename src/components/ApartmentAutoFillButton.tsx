"use client";

import { useState } from "react";
import { mergeApartmentListingDraft } from "@/lib/apartment-listing-draft";
import {
  computeListingFieldSuggestions,
  dispatchListingSuggestionsUpdated,
  syncListingFieldSuggestionsFromDraft,
} from "@/lib/listing-field-suggestions";
import {
  apartmentListingUrlFormId,
  applyListingPreviewToApartment,
  formatPrefilledFieldLabels,
  LISTING_PREVIEW_FIELD_LABELS,
  type ListingPreviewFieldKey,
} from "@/lib/listing-import-form";
import type { ListingPreviewFields } from "@/lib/listing-import";
import { APARTMENT_TOOLBAR_BTN_NEUTRAL } from "@/lib/apartment-toolbar-styles";

function resolveListingUrlInput(apartmentId: string, savedListingUrl: string | null): string {
  const form = document.getElementById(apartmentListingUrlFormId(apartmentId));
  const input = form?.querySelector('input[name="listingUrl"]') as HTMLInputElement | null;
  const fromInput = input?.value?.trim();
  if (fromInput) return fromInput;
  return savedListingUrl?.trim() ?? "";
}

export function ApartmentAutoFillButton({
  apartmentId,
  listingUrl,
  toolbar,
}: {
  apartmentId: string;
  listingUrl: string | null;
  toolbar?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function autoFill() {
    const url = resolveListingUrlInput(apartmentId, listingUrl);

    setLoading(true);
    setMessage(null);
    setWarnings([]);

    try {
      const res = await fetch(`/api/apartments/${apartmentId}/llm/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(url ? { url } : {}),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        fields?: ListingPreviewFields;
        warnings?: string[];
        highlights?: string;
        error?: string;
      };

      if (!res.ok || !data.fields) {
        setMessage("Daten konnten nicht geladen werden — Felder manuell ausfüllen.");
        setWarnings(data.warnings ?? []);
        return;
      }

      const filled = applyListingPreviewToApartment(apartmentId, data.fields, {
        onlyEmpty: true,
      });
      const suggestions = computeListingFieldSuggestions(apartmentId, data.fields);
      const suggestionKeys = suggestions.map((s) => s.key);
      mergeApartmentListingDraft(apartmentId, data.fields, filled, suggestionKeys);
      syncListingFieldSuggestionsFromDraft(apartmentId);
      dispatchListingSuggestionsUpdated(apartmentId);

      const fieldHint =
        filled.length > 0
          ? ` Übernommen und markiert: ${formatPrefilledFieldLabels(filled)}.`
          : "";
      const altHint =
        suggestionKeys.length > 0
          ? ` Abweichende KI-Vorschläge: ${suggestionKeys
              .map((k) => LISTING_PREVIEW_FIELD_LABELS[k])
              .join(", ")} (einzeln übernehmen).`
          : "";
      setMessage(
        `Leere Felder übernommen — bitte prüfen und speichern (Preis & Adresse inkl. Kosten, Titel, Beschreibung; Makler unter Finanzen).${fieldHint}${altHint}`
      );
      const w = [...(data.warnings ?? [])];
      if (data.highlights) w.push(`Besonderheiten: ${data.highlights}`);
      setWarnings(w);
    } catch {
      setMessage("Netzwerkfehler beim Laden der Daten.");
    } finally {
      setLoading(false);
    }
  }

  const statusHint = [message, ...warnings].filter(Boolean).join(" ");

  return (
    <div
      className={
        toolbar
          ? "inline-flex shrink-0"
          : "flex flex-col items-stretch sm:items-end gap-2 max-w-md"
      }
    >
      <button
        type="button"
        disabled={loading}
        onClick={() => void autoFill()}
        title={toolbar && statusHint ? statusHint : undefined}
        aria-busy={loading}
        className={
          toolbar
            ? `${APARTMENT_TOOLBAR_BTN_NEUTRAL} min-w-[9.5rem] justify-center`
            : "text-sm border border-pn-border px-3 py-1.5 rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50 font-medium"
        }
      >
        {loading
          ? toolbar
            ? "wird verarbeitet"
            : "wird verarbeitet…"
          : toolbar
            ? "Auto-Fill"
            : "Daten automatisch füllen"}
      </button>
      {!toolbar && !loading && message && (
        <p className="text-xs text-pn-text-secondary bg-pn-bg-subtle px-2 py-1.5 rounded-lg text-left sm:text-right">
          {message}
        </p>
      )}
      {!toolbar &&
        !loading &&
        warnings.map((w) => (
          <p key={w} className="text-xs text-pn-text-tertiary text-left sm:text-right">
            {w}
          </p>
        ))}
    </div>
  );
}
