"use client";

import { useState } from "react";
import {
  COMPANY_CAR_RATES,
  companyCarRateLabel,
  MARGINAL_TAX_RATE_OPTIONS,
  resolveMarginalTaxRatePercent,
  type CompanyCarRate,
} from "@/lib/company-car";
import { TRAVEL_MODES, travelModeLabel, type TravelMode } from "@/lib/travel-mode";

export function TravelModeForm({
  travelMode,
  companyCar,
  companyCarRate,
  listPrice,
  marginalTaxRatePercent,
  action,
}: {
  travelMode: TravelMode;
  companyCar: boolean;
  companyCarRate: CompanyCarRate;
  listPrice: number | null;
  marginalTaxRatePercent: number | null;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [mode, setMode] = useState(travelMode);
  const [isCompanyCar, setIsCompanyCar] = useState(companyCar);
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
                Monatlicher geldwerter Vorteil nach 1‑%-Regelung: Grundanteil vom
                Bruttolistenpreis plus Entfernungspauschale für den Arbeitsweg.
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
                  Wird auf volle 100 € abgerundet (wie beim Finanzamt).
                </span>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-pn-text-secondary">
                  Geschätzter Grenzsteuersatz (%)
                </span>
                <select
                  name="marginalTaxRatePercent"
                  defaultValue={resolveMarginalTaxRatePercent(marginalTaxRatePercent)}
                  className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {MARGINAL_TAX_RATE_OPTIONS.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate} %
                    </option>
                  ))}
                </select>
                <span className="block text-xs text-pn-text-tertiary mt-1">
                  Für die ca. Netto-Belastung aus dem geldwerten Vorteil (vereinfacht, ohne Soli/Kirchensteuer).
                </span>
              </label>
            </>
          )}
        </div>
      )}
    </form>
  );
}
