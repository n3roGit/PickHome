import { updateApartmentListingUrlAction } from "@/app/actions";

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
  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6 max-w-lg">
      <h2 className="font-semibold mb-1">Inserat-Link</h2>
      <p className="text-sm text-pn-text-secondary mb-4">
        URL zur Anzeige (z. B. ImmobilienScout, Kleinanzeigen).
      </p>
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
      <form action={updateApartmentListingUrlAction.bind(null, apartmentId)} className="flex flex-wrap gap-2">
        <input
          name="listingUrl"
          type="url"
          defaultValue={listingUrl ?? ""}
          placeholder="https://…"
          className="border border-pn-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <button type="submit" className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm">
          Speichern
        </button>
      </form>
    </section>
  );
}
