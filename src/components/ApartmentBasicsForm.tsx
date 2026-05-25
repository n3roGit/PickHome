import Link from "next/link";
import {
  geocodeApartmentAddressAction,
  updateApartmentBasicsAction,
} from "@/app/actions";
import { ApartmentPriceHistoryButton } from "@/components/ApartmentPriceHistoryButton";
import { ApartmentRevisionField } from "@/components/ApartmentRevisionField";
import { apartmentBasicsFormId } from "@/lib/listing-import-form";
import { GoogleMapsStreetViewLink } from "@/components/GoogleMapsStreetViewLink";
import { formatBudgetHint, formatPrice } from "@/lib/scoring";

export function ApartmentBasicsForm({
  projectId,
  apartmentId,
  revision,
  address,
  latitude,
  longitude,
  price,
  priceHistoryCount,
  timeZone,
  sizeSqm,
  plotSizeSqm,
  yearBuilt,
  energyClass,
  hoaFeeMonthly,
  heatingCostMonthly,
  propertyTaxAnnual,
  renovationCost,
  budget,
  saved,
  addressUnresolved,
  addressGeocoded,
  addressGeocodeFailed,
}: {
  projectId: string;
  apartmentId: string;
  revision: number;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price: number | null;
  priceHistoryCount: number;
  timeZone: string;
  sizeSqm?: number | null;
  plotSizeSqm?: number | null;
  yearBuilt?: number | null;
  energyClass?: string | null;
  hoaFeeMonthly?: number | null;
  heatingCostMonthly?: number | null;
  propertyTaxAnnual?: number | null;
  renovationCost?: number | null;
  budget: number | null;
  saved?: boolean;
  addressUnresolved?: boolean;
  addressGeocoded?: boolean;
  addressGeocodeFailed?: "empty" | "unresolved";
}) {
  const geocodeOnly = addressGeocoded || addressGeocodeFailed;

  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6">
      <h2 className="font-semibold mb-1">Preis & Adresse</h2>
      <p className="text-sm text-pn-text-secondary mb-4">
        Für Karte, Anfahrt und Wunschgebiet. Mit GetGeo nur diese Adresse per OpenStreetMap
        auflösen; Speichern übernimmt zusätzlich Preis und Fläche.
      </p>
      {addressGeocoded && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg mb-4">
          Adresse aufgelöst und gespeichert.
        </p>
      )}
      {addressGeocodeFailed === "empty" && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg mb-4">
          Bitte zuerst eine Adresse eingeben.
        </p>
      )}
      {addressGeocodeFailed === "unresolved" && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg mb-4">
          Die Adresse konnte nicht per OpenStreetMap aufgelöst werden (z. B. Tippfehler oder
          unvollständige Angabe). Bitte Straße, Hausnummer und Ort prüfen.
        </p>
      )}
      {saved && !addressUnresolved && !geocodeOnly && (
        <p className="text-sm text-pn-score-high bg-pn-score-high-bg px-3 py-2 rounded-lg mb-4">
          Preis und Adresse gespeichert.
        </p>
      )}
      {saved && addressUnresolved && !geocodeOnly && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg mb-4">
          Preis gespeichert. Die Adresse konnte nicht per OpenStreetMap aufgelöst werden (z. B.
          Tippfehler oder unvollständige Angabe). Bitte Straße, Hausnummer und Ort prüfen und
          erneut speichern.
        </p>
      )}
      <form
        id={apartmentBasicsFormId(apartmentId)}
        action={updateApartmentBasicsAction.bind(null, apartmentId)}
        className="space-y-3 max-w-lg"
        data-unsaved-track
        data-unsaved-label="Preis & Adresse"
      >
        <ApartmentRevisionField revision={revision} />
        <div className="block">
          <span className="text-sm font-medium text-pn-text-secondary">Adresse</span>
          <div className="mt-1 flex gap-2">
            <input
              name="address"
              defaultValue={address ?? ""}
              placeholder="Straße, PLZ Ort"
              className="flex-1 min-w-0 border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              formAction={geocodeApartmentAddressAction.bind(null, apartmentId)}
              className="shrink-0 bg-pn-bg-subtle border border-pn-border text-pn-text-primary font-medium px-3 py-2 rounded-lg text-sm hover:bg-pn-border/40"
              title="Nur diese Adresse per OpenStreetMap auflösen"
            >
              GetGeo
            </button>
          </div>
          {(address?.trim() || latitude != null) && (
            <GoogleMapsStreetViewLink
              latitude={latitude}
              longitude={longitude}
              address={address}
              className="text-sm text-pn-accent hover:underline inline-block mt-1"
            />
          )}
        </div>
        <p className="text-xs text-pn-text-tertiary">
          <Link
            href={`/project/${projectId}?tab=settings#addresses-reindex`}
            className="text-pn-accent hover:underline"
          >
            Alle Adressen im Projekt anreichern
          </Link>
          {" "}
          (Projekt-Einstellungen)
        </p>
        <label className="block">
          <span className="text-sm font-medium text-pn-text-secondary flex items-center gap-2">
            Preis (€)
            {priceHistoryCount > 0 && (
              <ApartmentPriceHistoryButton
                projectId={projectId}
                apartmentId={apartmentId}
                entryCount={priceHistoryCount}
                timeZone={timeZone}
              />
            )}
          </span>
          <input
            name="price"
            defaultValue={price != null ? String(price) : ""}
            placeholder="z. B. 350000"
            className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <div className="pt-2 border-t border-pn-border">
          <p className="text-sm font-medium text-pn-text-secondary mb-2">
            Laufende & einmalige Kosten (grob)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-pn-text-secondary">Hausgeld / Monat (€)</span>
              <input
                name="hoaFeeMonthly"
                defaultValue={hoaFeeMonthly != null ? String(hoaFeeMonthly) : ""}
                placeholder="z. B. 250"
                className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm text-pn-text-secondary">Heizkosten / Monat (€)</span>
              <input
                name="heatingCostMonthly"
                defaultValue={heatingCostMonthly != null ? String(heatingCostMonthly) : ""}
                placeholder="z. B. 120"
                className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm text-pn-text-secondary">Grundsteuer / Jahr (€)</span>
              <input
                name="propertyTaxAnnual"
                defaultValue={propertyTaxAnnual != null ? String(propertyTaxAnnual) : ""}
                placeholder="z. B. 600"
                className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm text-pn-text-secondary">Sanierung einmalig (€)</span>
              <input
                name="renovationCost"
                defaultValue={renovationCost != null ? String(renovationCost) : ""}
                placeholder="z. B. 30000"
                className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="block flex-1 min-w-[7rem] max-w-[10rem]">
            <span className="text-sm font-medium text-pn-text-secondary">Wohnfläche (m²)</span>
            <input
              name="sizeSqm"
              defaultValue={sizeSqm != null ? String(sizeSqm) : ""}
              placeholder="z. B. 85"
              className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block flex-1 min-w-[7rem] max-w-[10rem]">
            <span className="text-sm font-medium text-pn-text-secondary">Grundstück (m²)</span>
            <input
              name="plotSizeSqm"
              defaultValue={plotSizeSqm != null ? String(plotSizeSqm) : ""}
              placeholder="z. B. 350"
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
          <label className="block w-28">
            <span className="text-sm font-medium text-pn-text-secondary">Baujahr</span>
            <input
              name="yearBuilt"
              defaultValue={yearBuilt != null ? String(yearBuilt) : ""}
              placeholder="z. B. 1998"
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
