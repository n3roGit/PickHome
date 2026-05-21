"use client";

import { useState } from "react";
import { apartmentBasicsFormId, applyListingPreviewFields } from "@/lib/listing-import-form";
import type { ListingPreviewFields } from "@/lib/listing-import";

export function ApartmentLlmExtractButton({
  apartmentId,
  hasPdfText,
  hasListingUrl,
}: {
  apartmentId: string;
  hasPdfText: boolean;
  hasListingUrl: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  if (!hasPdfText && !hasListingUrl) return null;

  async function extract(source: "pdf" | "auto") {
    const basicsForm = document.getElementById(
      apartmentBasicsFormId(apartmentId)
    ) as HTMLFormElement | null;
    if (!basicsForm) {
      setMessage("Stammdaten-Formular nicht gefunden.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setWarnings([]);

    try {
      const res = await fetch(`/api/apartments/${apartmentId}/llm/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: source === "pdf" ? "pdf" : undefined }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        fields?: ListingPreviewFields;
        warnings?: string[];
        highlights?: string;
        error?: string;
      };

      if (!res.ok || !data.fields) {
        setMessage(
          data.error === "llm_not_configured"
            ? "KI nicht konfiguriert."
            : "Extraktion fehlgeschlagen — Felder manuell ausfüllen."
        );
        setWarnings(data.warnings ?? []);
        return;
      }

      applyListingPreviewFields(basicsForm, data.fields, { onlyEmpty: true });
      setMessage("Leere Felder übernommen — bitte prüfen und speichern.");
      setWarnings(data.warnings ?? []);
      if (data.highlights) {
        setWarnings((w) => [...w, `Besonderheiten: ${data.highlights}`]);
      }
    } catch {
      setMessage("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {hasPdfText && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void extract("pdf")}
          className="border border-pn-border font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-pn-bg-subtle disabled:opacity-50"
        >
          {loading ? "KI extrahiert…" : "Aus Exposé (KI)"}
        </button>
      )}
      {message && (
        <p className="text-sm text-pn-text-secondary w-full">{message}</p>
      )}
      {warnings.map((w) => (
        <p key={w} className="text-xs text-pn-text-tertiary w-full">
          {w}
        </p>
      ))}
    </div>
  );
}
