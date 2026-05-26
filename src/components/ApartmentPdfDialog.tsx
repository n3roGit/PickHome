"use client";

import { useEffect, useState } from "react";
import { APARTMENT_TOOLBAR_BTN_NEUTRAL } from "@/lib/apartment-toolbar-styles";

export function ApartmentPdfDialog({
  apartmentId,
  className = "",
}: {
  apartmentId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || APARTMENT_TOOLBAR_BTN_NEUTRAL}
        data-testid="apartment-pdf-button"
      >
        PDF
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="apartment-pdf-dialog-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 w-full max-w-lg shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="apartment-pdf-dialog-title" className="text-lg font-semibold mb-2">
              PDF exportieren
            </h2>
            <p className="text-sm text-pn-text-secondary mb-4">
              Wähle die passende Auswertung für deinen Anwendungsfall.
            </p>
            <div className="space-y-3">
              <div className="border border-pn-border rounded-lg p-4">
                <h3 className="font-medium text-pn-text-primary mb-1">Vollständige Übersicht</h3>
                <p className="text-sm text-pn-text-secondary mb-3">
                  Komplette Auswertung inkl. Bewertungen, Notizen, Fahrtwege und Besichtigungen.
                </p>
                <a
                  href={`/api/apartments/${apartmentId}/pdf`}
                  download
                  onClick={() => setOpen(false)}
                  data-testid="apartment-pdf-variant-full"
                  className="inline-block bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90"
                >
                  Herunterladen
                </a>
              </div>
              <div className="border border-pn-border rounded-lg p-4">
                <h3 className="font-medium text-pn-text-primary mb-1">Bankberater-Variante</h3>
                <p className="text-sm text-pn-text-secondary mb-3">
                  Objekt- und Finanzierungsdaten für die Baufinanzierungs-Anfrage — ohne Score,
                  Notizen oder Bewertungen.
                </p>
                <a
                  href={`/api/apartments/${apartmentId}/pdf?variant=bank`}
                  download
                  onClick={() => setOpen(false)}
                  data-testid="apartment-pdf-variant-bank"
                  className="inline-block bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm hover:opacity-90"
                >
                  Herunterladen
                </a>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                className="text-sm border border-pn-border px-3 py-1.5 rounded-lg hover:bg-pn-bg-subtle"
                onClick={() => setOpen(false)}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
