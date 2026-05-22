"use client";

import { useState, useTransition } from "react";
import { archiveApartmentAction, unarchiveApartmentAction } from "@/app/actions";
import { ARCHIVE_REASONS } from "@/lib/archive-reasons";
import { APARTMENT_TOOLBAR_BTN_NEUTRAL } from "@/lib/apartment-toolbar-styles";

export function ApartmentArchiveButton({
  apartmentId,
  archived,
  toolbar,
}: {
  apartmentId: string;
  archived: boolean;
  toolbar?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (archived) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => unarchiveApartmentAction(apartmentId))
        }
        className={toolbar ? APARTMENT_TOOLBAR_BTN_NEUTRAL : "text-sm border border-pn-border px-3 py-1.5 rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50"}
      >
        Wiederherstellen
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setDialogOpen(true)}
        className={toolbar ? APARTMENT_TOOLBAR_BTN_NEUTRAL : "text-sm border border-pn-border px-3 py-1.5 rounded-lg hover:bg-pn-bg-subtle disabled:opacity-50"}
      >
        Archivieren
      </button>
      {dialogOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-dialog-title"
        >
          <form
            action={(formData) =>
              startTransition(async () => {
                await archiveApartmentAction(apartmentId, formData);
                setDialogOpen(false);
              })
            }
            className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 w-full max-w-md shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="archive-dialog-title" className="text-lg font-semibold mb-2">
              Immobilie archivieren
            </h2>
            <p className="text-sm text-pn-text-secondary mb-4">
              Warum streicht ihr diese Immobilie? Das hilft später beim Auswerten.
            </p>
            <fieldset className="space-y-2 mb-4">
              {ARCHIVE_REASONS.map((r) => (
                <label
                  key={r.code}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="radio"
                    name="archiveReason"
                    value={r.code}
                    required
                    className="accent-pn-accent"
                  />
                  {r.labelDe}
                </label>
              ))}
            </fieldset>
            <label className="block text-sm text-pn-text-secondary mb-4">
              Notiz (optional)
              <textarea
                name="archiveNote"
                rows={2}
                maxLength={500}
                className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
                placeholder="Kurz ergänzen …"
              />
            </label>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                className="text-sm border border-pn-border px-3 py-1.5 rounded-lg hover:bg-pn-bg-subtle"
                onClick={() => setDialogOpen(false)}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={pending}
                className="text-sm bg-pn-accent text-white font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50"
              >
                Archivieren
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
