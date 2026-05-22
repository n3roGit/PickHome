"use client";

import { useRef, useState } from "react";
import { createApartmentAction } from "@/app/actions";
import { applyListingPreviewFields, formatPrefilledFieldLabels } from "@/lib/listing-import-form";
import type { ListingPreviewFields } from "@/lib/listing-import";

export function ListingImportAssist({ projectId }: { projectId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function loadFromListing(): Promise<boolean> {
    const form = formRef.current;
    if (!form) return false;
    const urlInput = form.elements.namedItem("listingUrl") as HTMLInputElement | null;
    const url = urlInput?.value?.trim();
    if (!url) {
      setMessage("Bitte zuerst eine Inserat-URL eintragen.");
      return false;
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
        highlights?: string;
        error?: string;
      };

      if (!res.ok || !data.fields) {
        setMessage("Daten konnten nicht geladen werden — Felder manuell ausfüllen.");
        setWarnings(data.warnings ?? []);
        return false;
      }

      const filled = applyListingPreviewFields(form, data.fields, { onlyEmpty: true });
      const fieldHint =
        filled.length > 0
          ? ` Markiert: ${formatPrefilledFieldLabels(filled)}.`
          : "";
      setMessage(`Leere Felder übernommen — bitte prüfen und „Immobilie hinzufügen“.${fieldHint}`);
      const w = [...(data.warnings ?? [])];
      if (data.highlights && !data.fields.description) {
        w.push(`Besonderheiten: ${data.highlights}`);
      }
      setWarnings(w);
      return true;
    } catch {
      setMessage("Netzwerkfehler beim Laden der Inserat-Seite.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = formRef.current;
    if (!form) return;

    const titleInput = form.elements.namedItem("title") as HTMLInputElement | null;
    const urlInput = form.elements.namedItem("listingUrl") as HTMLInputElement | null;
    let title = titleInput?.value?.trim() ?? "";
    const url = urlInput?.value?.trim() ?? "";

    if (!title && url) {
      e.preventDefault();
      setLoading(true);
      const ok = await loadFromListing();
      setLoading(false);
      title = titleInput?.value?.trim() ?? "";
      if (!ok || !title) {
        setMessage(
          "Ohne Titel keine Anlage möglich — „Daten automatisch füllen“ nutzen oder Titel eintragen."
        );
        return;
      }
      form.requestSubmit();
      return;
    }

    if (!title) {
      e.preventDefault();
      setMessage("Bitte einen Titel eintragen oder zuerst „Daten automatisch füllen“.");
      return;
    }

    setLoading(true);
    setMessage(null);
  }

  return (
    <form
      ref={formRef}
      action={createApartmentAction.bind(null, projectId)}
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="flex flex-col gap-3 mb-6"
    >
      <div className="flex flex-wrap gap-2 items-stretch sm:items-center">
        <input
          name="listingUrl"
          placeholder="Inserat-URL"
          type="url"
          className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full min-w-0 sm:flex-1 sm:min-w-[200px]"
        />
        <button
          type="button"
          onClick={() => void loadFromListing()}
          disabled={loading}
          className="border border-pn-border font-medium px-4 py-2 rounded-lg text-sm w-full sm:w-auto hover:bg-pn-bg-subtle disabled:opacity-50"
        >
          {loading ? "Wird ausgewertet…" : "Daten automatisch füllen"}
        </button>
      </div>
      {message && (
        <p className="text-sm text-pn-text-secondary bg-pn-bg-subtle px-3 py-2 rounded-lg">
          {message}
        </p>
      )}
      {warnings.map((w) => (
        <p key={w} className="text-xs text-pn-text-tertiary">
          {w}
        </p>
      ))}
      <div className="flex flex-wrap gap-2 items-stretch sm:items-center">
        <input
          name="title"
          placeholder="Titel"
          className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full min-w-0 sm:flex-1 sm:min-w-[200px]"
        />
        <input
          name="price"
          placeholder="Preis €"
          className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full sm:w-28 min-w-0"
        />
        <input
          name="sizeSqm"
          placeholder="Wohnfl. m²"
          className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full sm:w-24 min-w-0"
        />
        <input
          name="plotSizeSqm"
          placeholder="Grundst. m²"
          className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full sm:w-24 min-w-0"
        />
        <input
          name="energyClass"
          placeholder="Energieklasse"
          className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full sm:w-24 min-w-0"
        />
        <input
          name="address"
          placeholder="Adresse"
          className="border border-pn-border rounded-lg px-3 py-2 text-sm w-full min-w-0 sm:flex-1 sm:min-w-[160px]"
        />
        <label className="flex items-center gap-1.5 text-sm text-pn-text-secondary w-full sm:w-auto">
          <input type="checkbox" name="brokerInvolved" className="rounded border-pn-border" />
          Makler
        </label>
        <button
          type="submit"
          disabled={loading}
          className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm w-full sm:w-auto disabled:opacity-50"
        >
          {loading ? "Bitte warten…" : "Immobilie hinzufügen"}
        </button>
      </div>
      <textarea
        name="description"
        rows={3}
        placeholder="Beschreibung (optional, z. B. aus Inserat)"
        className="w-full border border-pn-border rounded-lg px-3 py-2 text-sm resize-y min-h-[72px]"
      />
    </form>
  );
}
