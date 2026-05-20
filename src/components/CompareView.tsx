import Link from "next/link";
import {
  apartmentCompareMetrics,
  formatBurdenShare,
  type ProjectFinanceSettings,
} from "@/lib/purchase-costs";
import { ScoreBadge } from "@/components/ScoreBadge";
import { apartmentScore, formatPrice, formatPricePerSqm } from "@/lib/scoring";

type Member = { user: { id: string; name: string } };
type Apartment = {
  id: string;
  title: string;
  address: string | null;
  price: number | null;
  sizeSqm: number | null;
  brokerInvolved: boolean;
};
type Criterion = { id: string; name: string; weight: number; isDealbreaker: boolean; groupName: string };
type Rating = {
  apartmentId: string;
  userId: string;
  criterionId: string;
  score: number | null;
};

function CompareNumbersTable({
  apartments,
  finance,
}: {
  apartments: Apartment[];
  finance: ProjectFinanceSettings;
}) {
  const rows = apartments.map((a) => ({
    apartment: a,
    metrics: apartmentCompareMetrics(a, finance),
  }));

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Zahlen im Vergleich</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-pn-border rounded-xl overflow-hidden min-w-[480px]">
          <thead className="bg-pn-bg-subtle">
            <tr>
              <th className="text-left p-3 sticky left-0 bg-pn-bg-subtle">Kennzahl</th>
              {apartments.map((a) => (
                <th key={a.id} className="p-3 text-right border-l border-pn-border min-w-[120px]">
                  <Link
                    href={`#compare-${a.id}`}
                    className="font-medium hover:text-pn-accent line-clamp-2"
                  >
                    {a.title}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <CompareRow label="Kaufpreis" values={rows.map((r) => formatPrice(r.apartment.price))} />
            <CompareRow
              label="Wohnfläche"
              values={rows.map((r) =>
                r.apartment.sizeSqm != null ? `${r.apartment.sizeSqm} m²` : "—"
              )}
            />
            <CompareRow
              label="€/m²"
              values={rows.map((r) => formatPricePerSqm(r.apartment.price, r.apartment.sizeSqm))}
            />
            <CompareRow
              label="Gesamtkosten (grob)"
              values={rows.map((r) => formatPrice(r.metrics.totalCost))}
            />
            <CompareRow
              label="Monatsrate (grob)"
              values={rows.map((r) => formatPrice(r.metrics.monthlyPayment))}
            />
            {finance.netHouseholdIncome != null && (
              <CompareRow
                label="Anteil vom Netto"
                valueClassNames={rows.map((r) =>
                  r.metrics.burdenLevel === "warn" ? "text-pn-score-low font-medium" : ""
                )}
                values={rows.map((r) =>
                  r.metrics.burdenShare != null ? formatBurdenShare(r.metrics.burdenShare) : "—"
                )}
              />
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-pn-text-tertiary mt-2">
        Monatsrate und Gesamtkosten basieren auf den Finanzierungs-Annahmen im Projekt.
      </p>
    </section>
  );
}

function CompareRow({
  label,
  values,
  valueClassNames,
}: {
  label: string;
  values: string[];
  valueClassNames?: string[];
}) {
  return (
    <tr className="border-t border-pn-border">
      <td className="p-3 text-pn-text-secondary sticky left-0 bg-pn-bg-surface">{label}</td>
      {values.map((value, i) => (
        <td
          key={i}
          className={`p-3 text-right tabular-nums border-l border-pn-border ${valueClassNames?.[i] ?? ""}`}
        >
          {value}
        </td>
      ))}
    </tr>
  );
}

export function CompareView({
  projectId,
  apartments,
  members,
  criteria,
  allRatings,
  finance,
  dealbreakerThreshold,
}: {
  projectId: string;
  apartments: Apartment[];
  members: Member[];
  criteria: Criterion[];
  allRatings: Rating[];
  finance: ProjectFinanceSettings;
  dealbreakerThreshold: number;
}) {
  return (
    <div className="space-y-8">
      <CompareNumbersTable apartments={apartments} finance={finance} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Gesamtscore</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-pn-border rounded-xl overflow-hidden">
            <thead className="bg-pn-bg-subtle">
              <tr>
                <th className="text-left p-3">Immobilie</th>
                {members.map((m) => (
                  <th key={m.user.id} className="p-3 text-center">
                    {m.user.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apartments.map((a) => (
                <tr key={a.id} id={`compare-${a.id}`} className="border-t border-pn-border">
                  <td className="p-3">
                    <Link
                      href={`/project/${projectId}/apartment/${a.id}`}
                      className="font-medium hover:text-pn-accent"
                    >
                      {a.title}
                    </Link>
                  </td>
                  {members.map((m) => {
                    const ratings = allRatings.filter(
                      (r) => r.apartmentId === a.id && r.userId === m.user.id
                    );
                    const { score, dealbreaker } = apartmentScore(
                      criteria,
                      ratings,
                      m.user.id,
                      dealbreakerThreshold
                    );
                    return (
                      <td key={m.user.id} className="p-3 text-center">
                        <ScoreBadge score={score} dealbreaker={dealbreaker} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {members.length < 2 && (
          <p className="text-sm text-pn-text-tertiary mt-3">
            Partner einladen, um „Meine Bewertung“ und „Partner-Bewertung“ zu vergleichen.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Kriterien im Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-pn-border rounded-xl overflow-hidden min-w-[640px]">
            <thead className="bg-pn-bg-subtle">
              <tr>
                <th className="text-left p-3 sticky left-0 bg-pn-bg-subtle">Kriterium</th>
                {apartments.map((a) => (
                  <th key={a.id} colSpan={members.length} className="p-3 text-center border-l border-pn-border">
                    {a.title}
                  </th>
                ))}
              </tr>
              <tr className="border-t border-pn-border">
                <th className="p-2 sticky left-0 bg-pn-bg-subtle" />
                {apartments.map((a) =>
                  members.map((m) => (
                    <th
                      key={`${a.id}-${m.user.id}`}
                      className="p-2 text-xs font-normal text-pn-text-tertiary text-center border-l border-pn-border"
                    >
                      {m.user.name}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {criteria.map((c) => (
                <tr key={c.id} className="border-t border-pn-border">
                  <td className="p-3 sticky left-0 bg-pn-bg-surface">
                    <span className="font-medium">{c.name}</span>
                    <span className="block text-xs text-pn-text-tertiary">{c.groupName}</span>
                  </td>
                  {apartments.map((a) =>
                    members.map((m) => {
                      const r = allRatings.find(
                        (x) =>
                          x.apartmentId === a.id &&
                          x.userId === m.user.id &&
                          x.criterionId === c.id
                      );
                      return (
                        <td
                          key={`${a.id}-${m.user.id}-${c.id}`}
                          className="p-3 text-center tabular-nums border-l border-pn-border"
                        >
                          {r?.score == null ? "—" : r.score}
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
