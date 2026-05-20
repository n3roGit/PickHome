"use client";

import { useRef, useState } from "react";
import { updateApartmentListingUrlAction } from "@/app/actions";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { apartmentBasicsFormId, applyListingPreviewFields } from "@/lib/listing-import-form";
import type { ListingPreviewFields } from "@/lib/listing-import";

export function ApartmentListingUrlForm({
  apartmentId,
  listingUrl,
  saved,
  invalid,
}: {
  apartmentId: string;
  listingUrl: string | null;
  saved?: boolean;
  invalid?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function loadFromListing() {
    const urlInput = formRef.current?.elements.namedItem("listingUrl") as HTMLInputElement | null;
    const url = urlInput?.value?.trim();
    if (!url) {
      setMessage("Bitte zuerst eine Inserat-URL eintragen.");
      return;
    }

    const basicsForm = document.getElementById(apartmentBasicsFormId(apartmentId)) as HTMLFormElement | null;
    if (!basicsForm) {
      setMessage("Stammdaten-Formular nicht gefunden.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setWarnings([]);
    try {
      const res = await fetch("/api/listing/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        fields?: ListingPreviewFields;
        warnings?: string[];
        error?: string;
      };

      if (!res.ok || !data.fields) {
        setMessage("Daten konnten nicht geladen werden — Felder manuell ausfüllen.");
        setWarnings(data.warnings ?? []);
        return;
      }

      applyListingPreviewFields(basicsForm, data.fields, { onlyEmpty: true });
      setMessage("Leere Felder übernommen — bitte prüfen und unter „Preis & Adresse“ speichern.");
      setWarnings(data.warnings ?? []);
    } catch {
      setMessage("Netzwerkfehler beim Laden der Inserat-Seite.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CollapsibleSection
      title="Inserat-Link"
      subtitle="URL zur Anzeige (z. B. ImmobilienScout, Kleinanzeigen)."
      defaultOpen
      className="max-w-lg"
    >
      {saved && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg mb-4">
          Link wurde gespeichert.
        </p>
      )}
      {invalid && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg mb-4">
          Bitte eine gültige URL eingeben (z. B. https://…).
        </p>
      )}
      <form
        ref={formRef}
        action={updateApartmentListingUrlAction.bind(null, apartmentId)}
        className="flex flex-wrap gap-2"
      >
        <input
          name="listingUrl"
          type="url"
          defaultValue={listingUrl ?? ""}
          placeholder="https://…"
          className="border border-pn-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <button
          type="button"
          onClick={loadFromListing}
          disabled={loading}
          className="border border-pn-border font-medium px-4 py-2 rounded-lg text-sm hover:bg-pn-bg-subtle disabled:opacity-50"
        >
          {loading ? "Lädt…" : "Daten laden"}
        </button>
        <button type="submit" className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm">
          Speichern
        </button>
      </form>
      {message && (
        <p className="text-sm text-pn-text-secondary bg-pn-bg-subtle px-3 py-2 rounded-lg mt-3">
          {message}
        </p>
      )}
      {warnings.map((w) => (
        <p key={w} className="text-xs text-pn-text-tertiary mt-1">
          {w}
        </p>
      ))}
    </CollapsibleSection>
  );
}
