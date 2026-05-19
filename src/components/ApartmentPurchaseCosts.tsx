import { updateApartmentBrokerAction } from "@/app/actions";
import {
  estimatePurchaseCosts,
  formatPercent,
  parseFederalStateCode,
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

export function ApartmentPurchaseCosts({
  apartmentId,
  price,
  federalStateCode,
  brokerInvolved,
  settingsHref,
}: {
  apartmentId: string;
  price: number | null;
  federalStateCode: string | null;
  brokerInvolved: boolean;
  settingsHref: string;
}) {
  const stateCode = parseFederalStateCode(federalStateCode);

  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6">
      <h2 className="font-semibold mb-1">Kaufnebenkosten (Schätzung)</h2>
      <p className="text-sm text-pn-text-secondary mb-4">
        Grobe Orientierung aus Kaufpreis, Bundesland und Makler — keine verbindliche Berechnung.
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

      {price != null && stateCode && (
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
          <CostTable
            estimate={estimatePurchaseCosts({
              price,
              federalStateCode: stateCode,
              brokerInvolved,
            })}
            price={price}
          />
        </>
      )}
    </section>
  );
}
