import { updateApartmentBrokerAction } from "@/app/actions";
import {
  estimateFinancing,
  estimatePurchaseCosts,
  formatPercent,
  parseFederalStateCode,
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

function FinancingTable({ financing }: { financing: FinancingEstimate }) {
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
          <tr>
            <td className="py-2 font-semibold">Monatliche Rate (grob)</td>
            <td className="py-2 text-right font-semibold">{formatPrice(financing.monthlyPayment)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ApartmentPurchaseCosts({
  apartmentId,
  price,
  federalStateCode,
  brokerBuyerRate,
  brokerInvolved,
  equityAmount,
  loanTermYears,
  interestRate,
  settingsHref,
}: {
  apartmentId: string;
  price: number | null;
  federalStateCode: string | null;
  brokerBuyerRate: number | null;
  brokerInvolved: boolean;
  equityAmount: number | null;
  loanTermYears: number | null;
  interestRate: number | null;
  settingsHref: string;
}) {
  const stateCode = parseFederalStateCode(federalStateCode);
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
          {financing && <FinancingTable financing={financing} />}
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
