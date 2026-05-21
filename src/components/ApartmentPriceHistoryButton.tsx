"use client";

import { useCallback, useState } from "react";
import { priceHistorySourceLabelDe } from "@/lib/apartment-price-history-labels";
import { formatDateTimeDe } from "@/lib/dates";
import { formatPrice } from "@/lib/scoring";

type PriceHistoryEntry = {
  id: string;
  price: number;
  previousPrice: number | null;
  source: string;
  recordedAt: string;
};

export function ApartmentPriceHistoryButton({
  projectId,
  apartmentId,
  entryCount,
  timeZone,
  className = "",
}: {
  projectId: string;
  apartmentId: string;
  entryCount: number;
  timeZone: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<PriceHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/apartments/${apartmentId}/price-history`
      );
      if (!res.ok) {
        setError("Verlauf konnte nicht geladen werden.");
        return;
      }
      const data = (await res.json()) as { entries?: PriceHistoryEntry[] };
      setEntries(data.entries ?? []);
    } catch {
      setError("Netzwerkfehler beim Laden des Preisverlaufs.");
    } finally {
      setLoading(false);
    }
  }, [projectId, apartmentId]);

  function openDialog() {
    setOpen(true);
    if (entries === null) void loadHistory();
  }

  if (entryCount < 1) return null;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={
          className ||
          "text-xs text-pn-accent hover:underline shrink-0"
        }
        title="Preisverlauf anzeigen"
      >
        Verlauf
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-history-dialog-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 w-full max-w-md shadow-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="price-history-dialog-title" className="text-lg font-semibold mb-3">
              Preisverlauf
            </h2>
            {loading && (
              <p className="text-sm text-pn-text-secondary">Lädt…</p>
            )}
            {error && (
              <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
            {!loading && !error && entries && entries.length === 0 && (
              <p className="text-sm text-pn-text-secondary">Noch keine Einträge.</p>
            )}
            {!loading && !error && entries && entries.length > 0 && (
              <ul className="space-y-3">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="border-b border-pn-border pb-3 last:border-0 last:pb-0"
                  >
                    <p className="font-medium">{formatPrice(e.price)}</p>
                    {e.previousPrice != null && (
                      <p className="text-xs text-pn-text-tertiary mt-0.5">
                        vorher {formatPrice(e.previousPrice)}
                      </p>
                    )}
                    <p className="text-xs text-pn-text-secondary mt-1">
                      {formatDateTimeDe(new Date(e.recordedAt), timeZone)} ·{" "}
                      {priceHistorySourceLabelDe(e.source)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
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
