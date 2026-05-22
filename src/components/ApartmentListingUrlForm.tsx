"use client";

import { updateApartmentListingUrlAction } from "@/app/actions";
import { ApartmentRevisionField } from "@/components/ApartmentRevisionField";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { apartmentListingUrlFormId } from "@/lib/listing-import-form";

export function ApartmentListingUrlForm({
  apartmentId,
  revision,
  listingUrl,
  saved,
  invalid,
}: {
  apartmentId: string;
  revision: number;
  listingUrl: string | null;
  saved?: boolean;
  invalid?: boolean;
}) {
  return (
    <CollapsibleSection
      title="Inserat-Link"
      subtitle="URL zur Anzeige (z. B. ImmobilienScout, Kleinanzeigen)."
      defaultOpen
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
        id={apartmentListingUrlFormId(apartmentId)}
        action={updateApartmentListingUrlAction.bind(null, apartmentId)}
        className="flex gap-2 w-full"
        data-unsaved-track
        data-unsaved-label="Inserat-Link"
      >
        <ApartmentRevisionField revision={revision} />
        <input
          name="listingUrl"
          type="url"
          defaultValue={listingUrl ?? ""}
          placeholder="https://…"
          className="flex-1 min-w-0 border border-pn-border rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="shrink-0 bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          Speichern
        </button>
      </form>
    </CollapsibleSection>
  );
}
