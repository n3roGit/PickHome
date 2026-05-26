import { updateApartmentBrokerAction } from "@/app/actions";
import { ApartmentRevisionField } from "@/components/ApartmentRevisionField";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import {
  apartmentMonthlyMaintenance,
  CONSERVATIVE_RENT_FACTOR,
  estimateAffordability,
  resolvePropertyTaxAnnual,
  estimateFinancing,
  estimatePurchaseCosts,
  formatBurdenShare,
  formatPercent,
  affordabilityLevelClass,
  purchaseCostLinesWithRenovation,
  resolveFederalStateCode,
  totalAcquisitionCost,
  type AffordabilityEstimate,
  type FinancingEstimate,
  type PurchaseCostEstimate,
} from "@/lib/purchase-costs";
import { formatPrice, formatPricePerPlotSqm } from "@/lib/scoring";
import { apartmentBrokerFormId } from "@/lib/listing-import-form";
import { ApartmentBorisInfo } from "@/components/ApartmentBorisInfo";
import type { ApartmentBorisSnapshot } from "@/lib/boris-cache";

function CostTable({
  estimate,
  price,
  renovationCost,
  acquisitionTotal,
}: {
  estimate: PurchaseCostEstimate;
  price: number;
  renovationCost: number | null;
  acquisitionTotal: number;
}) {
  const lines = purchaseCostLinesWithRenovation(estimate, renovationCost);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-pn-border">
            <td className="py-2 text-pn-text-secondary">Kaufpreis</td>
            <td className="py-2 text-right font-medium">{formatPrice(price)}</td>
          </tr>
          {lines.map((line) => (
            <tr key={line.key} className="border-b border-pn-border">
              <td className="py-2 text-pn-text-secondary">
                {line.label}
                {line.rate > 0 && (
                  <span className="text-pn-text-tertiary"> · {formatPercent(line.rate)}</span>
                )}
              </td>
              <td className="py-2 text-right">{formatPrice(line.amount)}</td>
            </tr>
          ))}
          <tr className="border-b border-pn-border font-medium">
            <td className="py-2">Kaufnebenkosten (grob)</td>
            <td className="py-2 text-right">{formatPrice(estimate.ancillaryTotal)}</td>
          </tr>
          <tr>
            <td className="py-2 font-semibold">Geschätzte Gesamtkosten</td>
            <td className="py-2 text-right font-semibold">{formatPrice(acquisitionTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AffordabilityWarningBanners({ affordability }: { affordability: AffordabilityEstimate }) {
  const banners: { level: "caution" | "warn"; text: string }[] = [];
  const rateLevel = affordability.rentConfigured
    ? affordability.effectiveRateLevel
    : affordability.rateLevel;
  const housingLevel = affordability.rentConfigured
    ? affordability.effectiveHousingLevel
    : affordability.housingLevel;
  const remainingLevel = affordability.rentConfigured
    ? affordability.effectiveRemainingLevel
    : affordability.remainingLevel;
  const afterRentNote = affordability.rentConfigured ? " (nach Miete)" : "";

  if (rateLevel === "caution") {
    banners.push({
      level: "caution",
      text: `Kreditrate über 35\u00a0% des Nettos${afterRentNote} — grobe Orientierung: eher knapp.`,
    });
  } else if (rateLevel === "warn") {
    banners.push({
      level: "warn",
      text: `Kreditrate über 45\u00a0% des Nettos${afterRentNote} — grobe Orientierung: eher kritisch.`,
    });
  }

  if (affordability.monthlyMaintenance > 0 && housingLevel === "caution") {
    banners.push({
      level: "caution",
      text: `Wohnkosten (Rate + Nebenkosten) über 40\u00a0% des Nettos${afterRentNote} — grobe Orientierung: eher knapp.`,
    });
  }

  if (affordability.fixedCostsConfigured) {
    if (remainingLevel === "warn") {
      banners.push({
        level: "warn",
        text: `Ausgaben übersteigen das Netto${afterRentNote} — grobe Orientierung: nicht tragbar.`,
      });
    } else if (remainingLevel === "caution") {
      banners.push({
        level: "caution",
        text: `Weniger als 10\u00a0% Puffer nach allen Kosten${afterRentNote} — grobe Orientierung: eher knapp.`,
      });
    }
  }

  if (banners.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      {banners.map((banner) => (
        <p
          key={banner.text}
          className={`text-sm px-3 py-2 rounded-lg ${
            banner.level === "warn"
              ? "text-pn-score-low bg-pn-score-low-bg"
              : "text-pn-score-mid bg-pn-score-mid-bg"
          }`}
        >
          {banner.text}
        </p>
      ))}
    </div>
  );
}

function FinancingTable({
  financing,
  affordability,
  settingsHref,
}: {
  financing: FinancingEstimate;
  affordability: AffordabilityEstimate | null;
  settingsHref: string;
}) {
  const rent = affordability?.rentConfigured ?? false;

  return (
    <div className="overflow-x-auto mt-6 pt-6 border-t border-pn-border">
      <h3 className="font-semibold text-sm mb-3">Finanzierung (Schätzung)</h3>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-pn-border">
            <td className="py-2 text-pn-text-secondary">Eigenkapital</td>
            <td className="py-2 text-right">{formatPrice(financing.equityAmount)}</td>
          </tr>
          <tr className="border-b border-pn-border">
            <td className="py-2 text-pn-text-secondary">Kreditsumme</td>
            <td className="py-2 text-right font-medium">{formatPrice(financing.loanAmount)}</td>
          </tr>
          <tr className="border-b border-pn-border">
            <td className="py-2 text-pn-text-secondary">
              Sollzins
              {financing.interestRateIsDefault && (
                <span className="text-pn-text-tertiary"> · Standard</span>
              )}
            </td>
            <td className="py-2 text-right">{formatPercent(financing.interestRate)}</td>
          </tr>
          <tr className="border-b border-pn-border">
            <td className="py-2 text-pn-text-secondary">Laufzeit</td>
            <td className="py-2 text-right">{financing.loanTermYears} Jahre</td>
          </tr>
          <tr className="border-b border-pn-border">
            <td className="py-2 font-semibold">Monatliche Rate (grob)</td>
            <td className="py-2 text-right font-semibold">{formatPrice(financing.monthlyPayment)}</td>
          </tr>
          {rent && affordability && (
            <>
              <tr className="border-b border-pn-border">
                <td className="py-2 text-pn-text-secondary">Kaltmiete / Monat</td>
                <td className="py-2 text-right">{formatPrice(affordability.coldRentMonthly)}</td>
              </tr>
              <tr className="border-b border-pn-border">
                <td className="py-2 text-pn-text-secondary">Mietdeckung der Rate</td>
                <td className="py-2 text-right">
                  {affordability.rentCoverageShare != null && (
                    <>
                      {formatBurdenShare(affordability.rentCoverageShare)} (
                      {formatPrice(affordability.coldRentMonthly)} von{" "}
                      {formatPrice(financing.monthlyPayment)})
                    </>
                  )}
                </td>
              </tr>
              <tr className="border-b border-pn-border">
                <td className="py-2 font-medium">Eigenanteil Rate / Monat</td>
                <td className="py-2 text-right font-medium">
                  {formatPrice(affordability.netRateBurden)}
                </td>
              </tr>
            </>
          )}
          <tr className="border-b border-pn-border">
            <td className="py-2 text-pn-text-secondary">
              Zinsen gesamt (grob)
              <span className="text-pn-text-tertiary"> · {financing.loanTermYears} Jahre</span>
            </td>
            <td className="py-2 text-right">{formatPrice(financing.totalInterest)}</td>
          </tr>
          <tr className={affordability ? "border-b border-pn-border" : ""}>
            <td className="py-2 font-semibold">
              Gesamt über Laufzeit (grob)
              <span className="block text-xs font-normal text-pn-text-tertiary">
                Eigenkapital + alle Raten
              </span>
            </td>
            <td className="py-2 text-right font-semibold">{formatPrice(financing.lifetimeTotal)}</td>
          </tr>
          {affordability && (
            <>
              {affordability.monthlyMaintenance > 0 && (
                <tr className="border-b border-pn-border">
                  <td className="py-2 text-pn-text-secondary">Hausgeld / Nebenkosten</td>
                  <td className="py-2 text-right">{formatPrice(affordability.monthlyMaintenance)}</td>
                </tr>
              )}
              {affordability.monthlyFixedCosts > 0 && (
                <tr className="border-b border-pn-border">
                  <td className="py-2 text-pn-text-secondary">Fixkosten / Monat</td>
                  <td className="py-2 text-right">{formatPrice(affordability.monthlyFixedCosts)}</td>
                </tr>
              )}
              <tr className="border-b border-pn-border font-medium">
                <td className="py-2">
                  Gesamtbelastung / Monat
                  {rent && (
                    <span className="block text-xs font-normal text-pn-text-tertiary">
                      ohne Miete
                    </span>
                  )}
                </td>
                <td className="py-2 text-right">{formatPrice(affordability.totalMonthlyBurden)}</td>
              </tr>
              <tr className={`border-b border-pn-border ${rent ? "" : ""}`}>
                <td className="py-2 text-pn-text-secondary">
                  Anteil Rate am Netto ({formatPrice(affordability.netHouseholdIncome)})
                  {rent && (
                    <span className="block text-xs text-pn-text-tertiary">ohne Miete</span>
                  )}
                </td>
                <td
                  className={`py-2 text-right font-semibold ${affordabilityLevelClass(affordability.rateLevel)}`}
                >
                  {formatBurdenShare(affordability.rateShare)}
                </td>
              </tr>
              {affordability.monthlyMaintenance > 0 && !rent && (
                <tr className="border-b border-pn-border">
                  <td className="py-2 text-pn-text-secondary">
                    Anteil Wohnkosten am Netto
                    <span className="block text-xs text-pn-text-tertiary">Rate + Nebenkosten</span>
                  </td>
                  <td
                    className={`py-2 text-right font-semibold ${affordabilityLevelClass(affordability.housingLevel)}`}
                  >
                    {formatBurdenShare(affordability.housingShare)}
                  </td>
                </tr>
              )}
              {rent && (
                <>
                  <tr className="border-b border-pn-border font-medium">
                    <td className="py-2">Gesamtbelastung nach Miete</td>
                    <td className="py-2 text-right font-medium">
                      {formatPrice(affordability.effectiveTotalMonthlyBurden)}
                    </td>
                  </tr>
                  <tr className="border-b border-pn-border">
                    <td className="py-2 text-pn-text-secondary">
                      Anteil Rate am Netto nach Miete
                    </td>
                    <td
                      className={`py-2 text-right font-semibold ${affordabilityLevelClass(affordability.effectiveRateLevel)}`}
                    >
                      {formatBurdenShare(affordability.effectiveRateShare)}
                    </td>
                  </tr>
                  {affordability.monthlyMaintenance > 0 && (
                    <tr className="border-b border-pn-border">
                      <td className="py-2 text-pn-text-secondary">
                        Anteil Wohnkosten am Netto nach Miete
                        <span className="block text-xs text-pn-text-tertiary">
                          Eigenanteil Rate + Nebenkosten
                        </span>
                      </td>
                      <td
                        className={`py-2 text-right font-semibold ${affordabilityLevelClass(affordability.effectiveHousingLevel)}`}
                      >
                        {formatBurdenShare(affordability.effectiveHousingShare)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-pn-border">
                    <td className="py-2 font-medium">Rest nach allen Kosten nach Miete</td>
                    <td
                      className={`py-2 text-right font-semibold ${
                        affordability.fixedCostsConfigured
                          ? affordabilityLevelClass(affordability.effectiveRemainingLevel)
                          : affordability.effectiveRemainingMonthly < 0
                            ? "text-pn-score-low"
                            : "text-pn-text-primary"
                      }`}
                    >
                      {formatPrice(affordability.effectiveRemainingMonthly)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-pn-text-tertiary text-xs">
                      Konservativ (Bank-Sicht, {Math.round(CONSERVATIVE_RENT_FACTOR * 100)} %)
                      <span className="block">Eigenanteil Rate / Monat</span>
                    </td>
                    <td className="py-2 text-right text-pn-text-tertiary text-xs">
                      {formatPrice(affordability.conservativeNetRateBurden)}
                    </td>
                  </tr>
                </>
              )}
              {!rent && (
                <tr>
                  <td className="py-2 font-medium">
                    Rest nach allen Kosten
                    {!affordability.fixedCostsConfigured && (
                      <span className="block text-xs font-normal text-pn-text-tertiary">
                        ohne Lebenshaltung
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-2 text-right font-semibold ${
                      affordability.fixedCostsConfigured
                        ? affordabilityLevelClass(affordability.remainingLevel)
                        : affordability.remainingMonthly < 0
                          ? "text-pn-score-low"
                          : "text-pn-text-primary"
                    }`}
                  >
                    {formatPrice(affordability.remainingMonthly)}
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
      {rent && (
        <p className="text-xs text-pn-text-tertiary mt-3">
          Grobe Orientierung — ohne Steuern und Verwaltung. Banken rechnen Mieten meist nur mit ca.{" "}
          {Math.round(CONSERVATIVE_RENT_FACTOR * 100)}&nbsp;% an.
        </p>
      )}
      {affordability && <AffordabilityWarningBanners affordability={affordability} />}
      {!affordability && (
        <p className="text-sm text-pn-text-tertiary mt-3">
          Für die Belastbarkeit im{" "}
          <a href={settingsHref} className="text-pn-accent hover:underline">
            Projekt
          </a>{" "}
          das Haushaltsnetto hinterlegen.
        </p>
      )}
    </div>
  );
}

export function ApartmentPurchaseCosts({
  apartmentId,
  revision,
  price,
  address,
  federalStateCode,
  brokerBuyerRate,
  brokerInvolved,
  coldRentMonthly,
  hoaFeeMonthly,
  heatingCostMonthly,
  propertyTaxAnnual,
  renovationCost,
  plotSizeSqm,
  sizeSqm,
  equityAmount,
  loanTermYears,
  interestRate,
  netHouseholdIncome,
  monthlyFixedCosts,
  settingsHref,
  borisSnapshot,
}: {
  apartmentId: string;
  revision: number;
  price: number | null;
  address: string | null;
  federalStateCode: string | null;
  brokerBuyerRate: number | null;
  brokerInvolved: boolean;
  coldRentMonthly: number | null;
  hoaFeeMonthly: number | null;
  heatingCostMonthly: number | null;
  propertyTaxAnnual: number | null;
  renovationCost: number | null;
  plotSizeSqm: number | null;
  sizeSqm: number | null;
  equityAmount: number | null;
  loanTermYears: number | null;
  interestRate: number | null;
  netHouseholdIncome: number | null;
  monthlyFixedCosts: number | null;
  settingsHref: string;
  borisSnapshot: ApartmentBorisSnapshot;
}) {
  const stateCode = resolveFederalStateCode({
    projectFederalStateCode: federalStateCode,
    apartmentAddress: address,
  });
  const canEstimateCosts = price != null && stateCode != null;
  const costEstimate = canEstimateCosts
    ? estimatePurchaseCosts({
        price,
        federalStateCode: stateCode,
        brokerInvolved,
        brokerBuyerRate,
      })
    : null;
  const acquisitionTotal = costEstimate
    ? totalAcquisitionCost(costEstimate, renovationCost)
    : null;
  const ongoingCosts = {
    hoaFeeMonthly,
    heatingCostMonthly,
    propertyTaxAnnual,
    price,
    sizeSqm,
    plotSizeSqm,
  };
  const propertyTaxResolved = resolvePropertyTaxAnnual(ongoingCosts);
  const monthlyMaintenance = apartmentMonthlyMaintenance(ongoingCosts);
  const financing =
    acquisitionTotal != null && equityAmount != null && loanTermYears != null
      ? estimateFinancing({
          totalCost: acquisitionTotal,
          equityAmount,
          loanTermYears,
          interestRate,
        })
      : null;
  const affordability =
    financing && netHouseholdIncome != null
      ? estimateAffordability({
          monthlyPayment: financing.monthlyPayment,
          netHouseholdIncome,
          monthlyMaintenance,
          monthlyFixedCosts,
          coldRentMonthly,
        })
      : null;
  const missingFinancingConfig = equityAmount == null || loanTermYears == null;

  return (
    <CollapsibleSection
      title="Finanzen"
      subtitle="Grobe Schätzung — keine verbindliche Berechnung."
    >
      {price == null && (
        <p className="text-sm text-pn-text-tertiary">Kaufpreis fehlt — Schätzung nicht möglich.</p>
      )}

      {price != null && !stateCode && (
        <p className="text-sm text-pn-text-tertiary">
          Bitte im{" "}
          <a href={settingsHref} className="text-pn-accent hover:underline">
            Projekt
          </a>{" "}
          ein Bundesland wählen.
        </p>
      )}

      {canEstimateCosts && costEstimate && (
        <>
          <form
            id={apartmentBrokerFormId(apartmentId)}
            action={updateApartmentBrokerAction.bind(null, apartmentId)}
            className="flex flex-wrap items-center gap-3 mb-3"
            data-unsaved-track
            data-unsaved-label="Makler (Finanzen)"
          >
            <ApartmentRevisionField revision={revision} />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="brokerInvolved"
                defaultChecked={brokerInvolved}
                className="rounded border-pn-border"
              />
              Mit Makler (Käuferanteil grob)
            </label>
            <button
              type="submit"
              className="bg-pn-bg-subtle border border-pn-border text-pn-text-primary font-medium px-3 py-1.5 rounded-lg text-sm hover:bg-pn-border/40"
            >
              Übernehmen
            </button>
          </form>
          <CostTable
            estimate={costEstimate}
            price={price}
            renovationCost={renovationCost}
            acquisitionTotal={acquisitionTotal!}
          />
          {(plotSizeSqm != null || propertyTaxResolved.isEstimate) && (
            <p className="text-xs text-pn-text-tertiary mt-3">
              {plotSizeSqm != null && (
                <>
                  Grundstück {plotSizeSqm} m²
                  {price != null && ` · ${formatPricePerPlotSqm(price, plotSizeSqm)}`}
                  {propertyTaxResolved.isEstimate ? " · " : ""}
                </>
              )}
              {propertyTaxResolved.isEstimate &&
                "Grundsteuer grob geschätzt (Orientierung), weil kein Jahresbetrag hinterlegt ist."}
            </p>
          )}
          {financing && (
            <FinancingTable
              financing={financing}
              affordability={affordability}
              settingsHref={settingsHref}
            />
          )}
          {missingFinancingConfig && (
            <p className="text-sm text-pn-text-tertiary mt-4">
              Für die Monatsrate im{" "}
              <a href={settingsHref} className="text-pn-accent hover:underline">
                Projekt
              </a>{" "}
              Eigenkapital und Abzahlungszeitraum hinterlegen.
            </p>
          )}
        </>
      )}
      <div className="mt-6">
        <ApartmentBorisInfo
          apartmentId={apartmentId}
          snapshot={borisSnapshot}
          plotSizeSqm={plotSizeSqm}
        />
      </div>
    </CollapsibleSection>
  );
}
