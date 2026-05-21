"use client";

import { useState } from "react";
import {
  apartmentListingUrlFormId,
  applyListingPreviewToApartment,
} from "@/lib/listing-import-form";
import type { ListingPreviewFields } from "@/lib/listing-import";

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
}: {
  apartmentId: string;
  listingUrl: string | null;
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

      applyListingPreviewToApartment(apartmentId, data.fields, { onlyEmpty: true });
      setMessage(
        "Leere Felder übernommen — bitte prüfen und speichern (Preis & Adresse, Titel, Beschreibung; Makler unter Kaufnebenkosten mit „Übernehmen“)."
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

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-2 max-w-md">
      <button
        type="button"
        disabled={loading}
        onClick={() => void autoFill()}
        className="text-sm border border-pn-border px-3 py-1.5 rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50 font-medium"
      >
        {loading ? "Wird ausgewertet…" : "Daten automatisch füllen"}
      </button>
      {message && (
        <p className="text-sm text-pn-text-secondary bg-pn-bg-subtle px-3 py-2 rounded-lg text-left sm:text-right">
          {message}
        </p>
      )}
      {warnings.map((w) => (
        <p key={w} className="text-xs text-pn-text-tertiary text-left sm:text-right">
          {w}
        </p>
      ))}
    </div>
  );
}
