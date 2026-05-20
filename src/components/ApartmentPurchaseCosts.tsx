import { updateApartmentBrokerAction } from "@/app/actions";
import {
  estimateAffordability,
  estimateFinancing,
  estimatePurchaseCosts,
  formatBurdenShare,
  formatPercent,
  resolveFederalStateCode,
  type AffordabilityEstimate,
  type FinancingEstimate,
  type PurchaseCostEstimate,
} from "@/lib/purchase-costs";
import { formatPrice } from "@/lib/scoring";

function CostTable({ estimate, price }: { estimate: PurchaseCostEstimate; price: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b border-pn-border">
            <td className="py-2 text-pn-text-secondary">Kaufpreis</td>
            <td className="py-2 text-right font-medium">{formatPrice(price)}</td>
          </tr>
          {estimate.lines.map((line) => (
            <tr key={line.key} className="border-b border-pn-border">
              <td className="py-2 text-pn-text-secondary">
                {line.label}
                <span className="text-pn-text-tertiary"> · {formatPercent(line.rate)}</span>
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
            <td className="py-2 text-right font-semibold">{formatPrice(estimate.totalWithPrice)}</td>
          </tr>
        </tbody>
      </table>
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
              <tr className="border-b border-pn-border font-medium">
                <td className="py-2">Gesamtbelastung / Monat</td>
                <td className="py-2 text-right">{formatPrice(affordability.totalMonthlyBurden)}</td>
              </tr>
              <tr>
                <td className="py-2 text-pn-text-secondary">
                  Anteil vom Netto ({formatPrice(affordability.netHouseholdIncome)})
                </td>
                <td
                  className={`py-2 text-right font-semibold ${
                    affordability.level === "warn" ? "text-pn-score-low" : "text-pn-score-high"
                  }`}
                >
                  {formatBurdenShare(affordability.burdenShare)}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
      {affordability?.level === "warn" && (
        <p className="text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg mt-3">
          Über 35&nbsp;% des Nettoeinkommens — grobe Orientierung: eher knapp bis kritisch.
        </p>
      )}
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
  price,
  address,
  federalStateCode,
  brokerBuyerRate,
  brokerInvolved,
  equityAmount,
  loanTermYears,
  interestRate,
  netHouseholdIncome,
  settingsHref,
}: {
  apartmentId: string;
  price: number | null;
  address: string | null;
  federalStateCode: string | null;
  brokerBuyerRate: number | null;
  brokerInvolved: boolean;
  equityAmount: number | null;
  loanTermYears: number | null;
  interestRate: number | null;
  netHouseholdIncome: number | null;
  settingsHref: string;
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
  const financing =
    costEstimate && equityAmount != null && loanTermYears != null
      ? estimateFinancing({
          totalCost: costEstimate.totalWithPrice,
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
        })
      : null;
  const missingFinancingConfig = equityAmount == null || loanTermYears == null;

  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6">
      <h2 className="font-semibold mb-1">Kaufnebenkosten & Finanzierung</h2>
      <p className="text-sm text-pn-text-secondary mb-4">
        Grobe Schätzung — keine verbindliche Berechnung.
      </p>

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
            action={updateApartmentBrokerAction.bind(null, apartmentId)}
            className="flex flex-wrap items-center gap-3 mb-4"
          >
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
          <CostTable estimate={costEstimate} price={price} />
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
    </section>
  );
}
