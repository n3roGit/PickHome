import {
  createUserAddressAction,
  deleteUserAddressAction,
  updateTravelModeAction,
  updateUserAddressAction,
} from "@/app/actions";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { TravelModeForm } from "@/components/TravelModeForm";
import type { TransitFallbackMode } from "@/lib/transit-settings";
import { travelModeLabel, type TravelMode } from "@/lib/travel-mode";
import type { CompanyCarCommuteMethod, CompanyCarRate } from "@/lib/company-car";

type AddressRow = {
  id: string;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  isWorkplace: boolean;
};

export function UserCommuteSettings({
  travelMode,
  transitArrivalHour,
  transitArrivalMinute,
  transitArrivalWeekday,
  transitFallbackMaxKm,
  transitFallbackMode,
  companyCar,
  companyCarRate,
  listPrice,
  marginalTaxRatePercent,
  companyCarCommuteMethod,
  companyCarOfficeTripsPerMonth,
  companyCarContributionEur,
  companyCarSelfPaidCostsEur,
  companyCarEmployerFuelCard,
  addresses,
  saved,
  addressSaved,
  addressDeleted,
  error,
}: {
  travelMode: TravelMode;
  transitArrivalHour: number;
  transitArrivalMinute: number;
  transitArrivalWeekday: number;
  transitFallbackMaxKm: number | null;
  transitFallbackMode: TransitFallbackMode | null;
  companyCar: boolean;
  companyCarRate: CompanyCarRate;
  listPrice: number | null;
  marginalTaxRatePercent: number | null;
  companyCarCommuteMethod: CompanyCarCommuteMethod;
  companyCarOfficeTripsPerMonth: number | null;
  companyCarContributionEur: number | null;
  companyCarSelfPaidCostsEur: number | null;
  companyCarEmployerFuelCard: boolean;
  addresses: AddressRow[];
  saved?: boolean;
  addressSaved?: boolean;
  addressDeleted?: boolean;
  error?: string;
}) {
  const errors: Record<string, string> = {
    label: "Bitte eine Bezeichnung angeben.",
    address: "Bitte eine Adresse angeben.",
  };

  return (
    <div className="space-y-6">
      {saved && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
          Verkehrsmittel gespeichert.
        </p>
      )}
      {addressSaved && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
          Adresse gespeichert.
        </p>
      )}
      {addressDeleted && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg">
          Adresse gelöscht.
        </p>
      )}
      {error && errors[error] && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">
          {errors[error]}
        </p>
      )}

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5">
        <h2 className="font-semibold mb-1">Standard-Verkehrsmittel</h2>
        <p className="text-sm text-pn-text-secondary mb-4">
          Für Entfernung und Fahrzeit zu deinen Adressen ({TRAVEL_MODE_SUMMARY}).
        </p>
        <TravelModeForm
          travelMode={travelMode}
          transitArrivalHour={transitArrivalHour}
          transitArrivalMinute={transitArrivalMinute}
          transitArrivalWeekday={transitArrivalWeekday}
          transitFallbackMaxKm={transitFallbackMaxKm}
          transitFallbackMode={transitFallbackMode}
          companyCar={companyCar}
          companyCarRate={companyCarRate}
          listPrice={listPrice}
          marginalTaxRatePercent={marginalTaxRatePercent}
          companyCarCommuteMethod={companyCarCommuteMethod}
          companyCarOfficeTripsPerMonth={companyCarOfficeTripsPerMonth}
          companyCarContributionEur={companyCarContributionEur}
          companyCarSelfPaidCostsEur={companyCarSelfPaidCostsEur}
          companyCarEmployerFuelCard={companyCarEmployerFuelCard}
          action={updateTravelModeAction}
        />
      </section>

      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold mb-1">Meine Adressen</h2>
          <p className="text-sm text-pn-text-secondary">
            z. B. Arbeit, Kita — werden bei jeder Immobilie für Anfahrtsschätzungen genutzt. Firmenwagen-Kosten
            nur bei als Arbeitsstätte markierten Adressen.
          </p>
        </div>

        {addresses.map((addr) => (
          <div key={addr.id} className="border border-pn-border rounded-lg p-4 space-y-3">
            <form action={updateUserAddressAction.bind(null, addr.id)} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-pn-text-secondary">Bezeichnung</span>
                <input
                  name="label"
                  defaultValue={addr.label}
                  required
                  className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-pn-text-secondary">Adresse</span>
                <input
                  name="address"
                  defaultValue={addr.address}
                  required
                  className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isWorkplace"
                  defaultChecked={addr.isWorkplace}
                  className="mt-1"
                />
                <span>
                  <span className="text-sm font-medium">Arbeitsstätte</span>
                  <span className="block text-xs text-pn-text-tertiary mt-0.5">
                    Firmenwagen-Arbeitsweg-Kosten nur für diese Adresse berechnen.
                  </span>
                </span>
              </label>
              {addr.latitude == null && (
                <p className="text-xs text-pn-score-low">Koordinaten fehlen — Adresse speichern zum Geocoding.</p>
              )}
              <button
                type="submit"
                className="bg-pn-bg-subtle border border-pn-border text-pn-text-primary font-medium px-3 py-1.5 rounded-lg text-sm"
              >
                Aktualisieren
              </button>
            </form>
            <ConfirmActionButton
              confirmMessage={`Adresse „${addr.label}" wirklich löschen?`}
              action={() => deleteUserAddressAction(addr.id)}
              className="text-sm text-pn-score-low hover:underline disabled:opacity-50"
              pendingLabel="Löscht…"
            >
              Löschen
            </ConfirmActionButton>
          </div>
        ))}

        <form action={createUserAddressAction} className="border border-dashed border-pn-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Neue Adresse</p>
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Bezeichnung</span>
            <input
              name="label"
              placeholder="z. B. Arbeit"
              required
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-pn-text-secondary">Adresse</span>
            <input
              name="address"
              placeholder="Straße, PLZ Ort"
              required
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" name="isWorkplace" className="mt-1" />
            <span>
              <span className="text-sm font-medium">Arbeitsstätte</span>
              <span className="block text-xs text-pn-text-tertiary mt-0.5">
                Firmenwagen-Arbeitsweg-Kosten nur für diese Adresse berechnen.
              </span>
            </span>
          </label>
          <button
            type="submit"
            className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
          >
            Adresse hinzufügen
          </button>
        </form>
      </section>
    </div>
  );
}

const TRAVEL_MODE_SUMMARY = (["foot", "bike", "driving", "transit"] as const)
  .map((m) => travelModeLabel(m))
  .join(", ");
