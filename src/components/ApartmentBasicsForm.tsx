import { updateApartmentBasicsAction } from "@/app/actions";
import { formatBudgetHint, formatPrice } from "@/lib/scoring";

export function ApartmentBasicsForm({
  apartmentId,
  address,
  price,
  budget,
  saved,
}: {
  apartmentId: string;
  address: string | null;
  price: number | null;
  budget: number | null;
  saved?: boolean;
}) {
  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6">
      <h2 className="font-semibold mb-1">Preis & Adresse</h2>
      <p className="text-sm text-pn-text-secondary mb-4">
        Für Karte, Anfahrt und Kostenrechnung. Adresse wird für Koordinaten geocodiert.
      </p>
      {saved && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg mb-4">
          Preis und Adresse gespeichert.
        </p>
      )}
      <form action={updateApartmentBasicsAction.bind(null, apartmentId)} className="space-y-3 max-w-lg">
        <label className="block">
          <span className="text-sm font-medium text-pn-text-secondary">Adresse</span>
          <input
            name="address"
            defaultValue={address ?? ""}
            placeholder="Straße, PLZ Ort"
            className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-pn-text-secondary">Preis (€)</span>
          <input
            name="price"
            defaultValue={price != null ? String(price) : ""}
            placeholder="z. B. 350000"
            className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
          />
        </label>
        {price != null && budget != null && (
          <p
            className={`text-sm ${
              price > budget
                ? "text-pn-score-low"
                : price < budget
                  ? "text-pn-score-high"
                  : "text-pn-text-tertiary"
            }`}
          >
            {formatPrice(price)} · {formatBudgetHint(price, budget)}
          </p>
        )}
        <button
          type="submit"
          className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          Speichern
        </button>
      </form>
    </section>
  );
}
