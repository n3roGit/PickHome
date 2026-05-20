import { updateApartmentBasicsAction } from "@/app/actions";
import { formatBudgetHint, formatPrice } from "@/lib/scoring";

export function ApartmentBasicsForm({
  apartmentId,
  address,
  price,
  sizeSqm,
  energyClass,
  budget,
  saved,
}: {
  apartmentId: string;
  address: string | null;
  price: number | null;
  sizeSqm?: number | null;
  energyClass?: string | null;
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
        <div className="flex flex-wrap gap-3">
          <label className="block flex-1 min-w-[120px]">
            <span className="text-sm font-medium text-pn-text-secondary">Wohnfläche (m²)</span>
            <input
              name="sizeSqm"
              defaultValue={sizeSqm != null ? String(sizeSqm) : ""}
              placeholder="z. B. 85"
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block w-28">
            <span className="text-sm font-medium text-pn-text-secondary">Energieklasse</span>
            <input
              name="energyClass"
              defaultValue={energyClass ?? ""}
              placeholder="z. B. C"
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
        </div>
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
