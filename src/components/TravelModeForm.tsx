"use client";

import { useState } from "react";
import {
  COMPANY_CAR_COMMUTE_METHODS,
  COMPANY_CAR_RATES,
  companyCarCommuteMethodLabel,
  companyCarRateLabel,
  ELECTRIC_LIST_PRICE_CAP_EUR,
  MARGINAL_TAX_RATE_OPTIONS,
  marginalTaxRateOptionLabel,
  parseCompanyCarCommuteMethod,
  resolveMarginalTaxRatePercent,
  type CompanyCarCommuteMethod,
  type CompanyCarRate,
} from "@/lib/company-car";
import { TRAVEL_MODES, travelModeLabel, type TravelMode } from "@/lib/travel-mode";

export function TravelModeForm({
  travelMode,
  companyCar,
  companyCarRate,
  listPrice,
  marginalTaxRatePercent,
  companyCarCommuteMethod,
  companyCarOfficeTripsPerMonth,
  companyCarContributionEur,
  companyCarSelfPaidCostsEur,
  companyCarEmployerFuelCard,
  action,
}: {
  travelMode: TravelMode;
  companyCar: boolean;
  companyCarRate: CompanyCarRate;
  listPrice: number | null;
  marginalTaxRatePercent: number | null;
  companyCarCommuteMethod: CompanyCarCommuteMethod;
  companyCarOfficeTripsPerMonth: number | null;
  companyCarContributionEur: number | null;
  companyCarSelfPaidCostsEur: number | null;
  companyCarEmployerFuelCard: boolean;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [mode, setMode] = useState(travelMode);
  const [isCompanyCar, setIsCompanyCar] = useState(companyCar);
  const [commuteMethod, setCommuteMethod] = useState(companyCarCommuteMethod);
  const [employerFuelCard, setEmployerFuelCard] = useState(companyCarEmployerFuelCard);
  const showCompanyCar = mode === "driving";

  return (
    <form action={action} className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="block flex-1 min-w-[180px]">
          <span className="text-sm font-medium text-pn-text-secondary">Verkehrsmittel</span>
          <select
            name="travelMode"
            value={mode}
            onChange={(e) => setMode(e.target.value as TravelMode)}
            className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {TRAVEL_MODES.map((m) => (
              <option key={m} value={m}>
                {travelModeLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="bg-pn-accent text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          Speichern
        </button>
      </div>

      {showCompanyCar && (
        <div className="border border-pn-border rounded-lg p-4 space-y-3 bg-pn-bg-subtle/50">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="companyCar"
              checked={isCompanyCar}
              onChange={(e) => setIsCompanyCar(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="text-sm font-medium">Firmenwagen (Dienstwagen)</span>
              <span className="block text-xs text-pn-text-tertiary mt-0.5">
                Geldwerter Vorteil nach 1‑%-Regelung: Privatnutzung plus Arbeitsweg, abzüglich
                anrechenbarer Eigenleistungen.
              </span>
            </span>
          </label>

          {isCompanyCar && (
            <>
              <label className="block">
                <span className="text-sm font-medium text-pn-text-secondary">Antriebsart</span>
                <select
                  name="companyCarRate"
                  defaultValue={companyCarRate}
                  className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {COMPANY_CAR_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {companyCarRateLabel(rate)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-pn-text-secondary">Bruttolistenpreis (€)</span>
                <input
                  name="listPrice"
                  type="number"
                  min={100}
                  step={100}
                  defaultValue={listPrice ?? ""}
                  key={listPrice ?? "empty"}
                  placeholder="z. B. 40700"
                  className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
                />
                <span className="block text-xs text-pn-text-tertiary mt-1">
                  Wird auf volle 100 € abgerundet (wie beim Finanzamt). Bei Elektro über{" "}
                  {ELECTRIC_LIST_PRICE_CAP_EUR.toLocaleString("de-DE")} € gelten die halbierten Sätze.
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-pn-text-secondary">Arbeitsweg berechnen als</span>
                <select
                  name="companyCarCommuteMethod"
                  value={commuteMethod}
                  onChange={(e) =>
                    setCommuteMethod(parseCompanyCarCommuteMethod(e.target.value))
                  }
                  className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {COMPANY_CAR_COMMUTE_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {companyCarCommuteMethodLabel(method)}
                    </option>
                  ))}
                </select>
              </label>

              {commuteMethod === "trips" && (
                <label className="block">
                  <span className="text-sm font-medium text-pn-text-secondary">
                    Bürofahrten pro Monat
                  </span>
                  <input
                    name="companyCarOfficeTripsPerMonth"
                    type="number"
                    min={1}
                    max={31}
                    step={1}
                    defaultValue={companyCarOfficeTripsPerMonth ?? ""}
                    placeholder="z. B. 8"
                    className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
                  />
                  <span className="block text-xs text-pn-text-tertiary mt-1">
                    Für Homeoffice mit wenigen Präsenztagen — 0,002 % × km × Fahrten.
                  </span>
                </label>
              )}

              <label className="block">
                <span className="text-sm font-medium text-pn-text-secondary">
                  Eigenbeteiligung (€/Monat)
                </span>
                <input
                  name="companyCarContributionEur"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={companyCarContributionEur ?? ""}
                  placeholder="z. B. 150"
                  className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
                />
                <span className="block text-xs text-pn-text-tertiary mt-1">
                  Monatlicher Eigenanteil oder Gehaltsumwandlung — mindert den geldwerten Vorteil.
                </span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="companyCarEmployerFuelCard"
                  checked={employerFuelCard}
                  onChange={(e) => setEmployerFuelCard(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="text-sm font-medium">Tank-/Ladekarte vom Arbeitgeber</span>
                  <span className="block text-xs text-pn-text-tertiary mt-0.5">
                    In der 1‑%-Regelung bereits enthalten — erhöht den geldwerten Vorteil nicht
                    zusätzlich.
                  </span>
                </span>
              </label>

              {!employerFuelCard && (
                <label className="block">
                  <span className="text-sm font-medium text-pn-text-secondary">
                    Selbst getragene Kraftstoff-/Ladekosten (€/Monat)
                  </span>
                  <input
                    name="companyCarSelfPaidCostsEur"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={companyCarSelfPaidCostsEur ?? ""}
                    placeholder="z. B. 80"
                    className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm"
                  />
                  <span className="block text-xs text-pn-text-tertiary mt-1">
                    Nachweisbare Kosten mindern den geldwerten Vorteil (max. bis 0 €).
                  </span>
                </label>
              )}

              <label className="block">
                <span className="text-sm font-medium text-pn-text-secondary">
                  Geschätzter Grenzsteuersatz (%)
                </span>
                <select
                  name="marginalTaxRatePercent"
                  defaultValue={resolveMarginalTaxRatePercent(marginalTaxRatePercent)}
                  className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {MARGINAL_TAX_RATE_OPTIONS.map((option) => (
                    <option key={option.percent} value={option.percent}>
                      {marginalTaxRateOptionLabel(option)}
                    </option>
                  ))}
                </select>
                <span className="block text-xs text-pn-text-tertiary mt-1">
                  Grobe Netto-Schätzung aus dem geldwerten Vorteil, ohne Soli, Kirchensteuer und
                  Sozialabgaben.
                </span>
              </label>
            </>
          )}
        </div>
      )}
    </form>
  );
}
