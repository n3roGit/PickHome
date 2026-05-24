"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  apartmentCompareMetrics,
  affordabilityLevelClass,
  formatBurdenShare,
  type ProjectFinanceSettings,
} from "@/lib/purchase-costs";
import { ScoreBadge } from "@/components/ScoreBadge";
import { PartnerDivergenceCompareBlock } from "@/components/PartnerDivergencePanel";
import { partnerComparisons } from "@/lib/rating-divergence";
import { apartmentScore, formatPrice, formatPricePerPlotSqm, formatPricePerSqm } from "@/lib/scoring";

const MAX_COMPARE = 5;

type Member = { user: { id: string; name: string } };
type Apartment = {
  id: string;
  title: string;
  address: string | null;
  price: number | null;
  sizeSqm: number | null;
  plotSizeSqm?: number | null;
  brokerInvolved: boolean;
  hoaFeeMonthly?: number | null;
  heatingCostMonthly?: number | null;
  propertyTaxAnnual?: number | null;
  renovationCost?: number | null;
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
      <p className="text-xs text-pn-text-tertiary mb-2 sm:hidden">Tabelle horizontal wischen</p>
      <div className="pn-scroll-x">
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
              label="Grundstück"
              values={rows.map((r) =>
                r.apartment.plotSizeSqm != null ? `${r.apartment.plotSizeSqm} m²` : "—"
              )}
            />
            <CompareRow
              label="€/m² Grundstück"
              values={rows.map((r) =>
                formatPricePerPlotSqm(r.apartment.price, r.apartment.plotSizeSqm ?? null)
              )}
            />
            <CompareRow
              label="Gesamtkosten (grob)"
              values={rows.map((r) => formatPrice(r.metrics.totalCost))}
            />
            <CompareRow
              label="Monatsrate (grob)"
              values={rows.map((r) => formatPrice(r.metrics.monthlyPayment))}
            />
            <CompareRow
              label="Gesamtbelastung/Monat (grob)"
              values={rows.map((r) => formatPrice(r.metrics.totalMonthlyBurden))}
            />
            {finance.netHouseholdIncome != null && (
              <CompareRow
                label="Anteil Rate am Netto"
                valueClassNames={rows.map((r) => {
                  if (r.metrics.burdenLevel == null) return "";
                  const cls = affordabilityLevelClass(r.metrics.burdenLevel);
                  return r.metrics.burdenLevel === "ok" ? "" : `${cls} font-medium`;
                })}
                values={rows.map((r) =>
                  r.metrics.burdenShare != null ? formatBurdenShare(r.metrics.burdenShare) : "—"
                )}
              />
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-pn-text-tertiary mt-2">
        Monatsrate, Gesamtbelastung und Gesamtkosten basieren auf den Finanzierungs-Annahmen im Projekt.
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

function CompareSelection({
  projectId,
  apartments,
  selectedIds,
  onToggle,
}: {
  projectId: string;
  apartments: Apartment[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const atLimit = selectedIds.size >= MAX_COMPARE;

  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold">Immobilien auswählen</h2>
        <p className="text-sm text-pn-text-secondary tabular-nums">
          {selectedIds.size} / {MAX_COMPARE} ausgewählt
        </p>
      </div>
      <p className="text-sm text-pn-text-secondary mb-4">
        Aktiviere bis zu {MAX_COMPARE} Immobilien für den Vergleich. Die Tabellen unten zeigen nur
        die Auswahl.
      </p>
      {apartments.length === 0 ? (
        <p className="text-pn-text-tertiary">Noch keine aktiven Immobilien in diesem Projekt.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {apartments.map((a) => {
            const checked = selectedIds.has(a.id);
            const disabled = !checked && atLimit;
            return (
              <li key={a.id}>
                <label
                  className={`flex items-start gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-colors ${
                    checked
                      ? "border-pn-accent bg-pn-accent/5"
                      : disabled
                        ? "border-pn-border opacity-50 cursor-not-allowed"
                        : "border-pn-border hover:border-pn-border-strong"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 shrink-0 accent-pn-accent"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggle(a.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium block truncate">{a.title}</span>
                    {a.address ? (
                      <span className="text-xs text-pn-text-tertiary block truncate">{a.address}</span>
                    ) : null}
                    <span className="text-xs text-pn-text-secondary mt-1 block">
                      {formatPrice(a.price)}
                      {a.sizeSqm != null ? ` · ${a.sizeSqm} m²` : ""}
                    </span>
                  </span>
                  <Link
                    href={`/project/${projectId}/apartment/${a.id}`}
                    className="text-xs text-pn-accent hover:underline shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Details
                  </Link>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {atLimit && apartments.length > MAX_COMPARE ? (
        <p className="text-xs text-pn-text-tertiary mt-3">
          Maximal {MAX_COMPARE} Immobilien gleichzeitig — eine abwählen, um eine andere zu wählen.
        </p>
      ) : null}
    </section>
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
  currentUserId,
}: {
  projectId: string;
  apartments: Apartment[];
  members: Member[];
  criteria: Criterion[];
  allRatings: Rating[];
  finance: ProjectFinanceSettings;
  dealbreakerThreshold: number;
  currentUserId: string;
}) {
  const partners = members
    .filter((m) => m.user.id !== currentUserId)
    .map((m) => ({ userId: m.user.id, name: m.user.name }));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_COMPARE) {
        next.add(id);
      }
      return next;
    });
  };

  const selectedApartments = useMemo(
    () => apartments.filter((a) => selectedIds.has(a.id)),
    [apartments, selectedIds]
  );

  const hasSelection = selectedApartments.length > 0;

  return (
    <div className="space-y-8">
      <CompareSelection
        projectId={projectId}
        apartments={apartments}
        selectedIds={selectedIds}
        onToggle={toggleSelection}
      />

      {!hasSelection ? (
        <p className="text-center text-pn-text-tertiary py-8">
          Wähle mindestens eine Immobilie, um die Vergleichstabellen anzuzeigen.
        </p>
      ) : (
        <>
          <CompareNumbersTable apartments={selectedApartments} finance={finance} />

          {partners.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Meinungsunterschiede</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedApartments.map((a) => (
                  <PartnerDivergenceCompareBlock
                    key={a.id}
                    apartmentTitle={a.title}
                    comparisons={partnerComparisons({
                      criteria,
                      ratings: allRatings,
                      apartmentId: a.id,
                      currentUserId,
                      partners,
                      dealbreakerThreshold,
                    })}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold mb-3">Gesamtscore</h2>
            <div className="pn-scroll-x">
              <table className="w-full text-sm border border-pn-border rounded-xl overflow-hidden min-w-[320px]">
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
                  {selectedApartments.map((a) => (
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
                        const { score, displayScore, dealbreaker } = apartmentScore(
                          criteria,
                          ratings,
                          m.user.id,
                          dealbreakerThreshold
                        );
                        return (
                          <td key={m.user.id} className="p-3 text-center">
                            <ScoreBadge
                              score={score}
                              displayScore={displayScore}
                              dealbreaker={dealbreaker}
                            />
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
            <p className="text-xs text-pn-text-tertiary mb-2 sm:hidden">Tabelle horizontal wischen</p>
            <div className="pn-scroll-x">
              <table className="w-full text-sm border border-pn-border rounded-xl overflow-hidden min-w-[640px]">
                <thead className="bg-pn-bg-subtle">
                  <tr>
                    <th className="text-left p-3 sticky left-0 bg-pn-bg-subtle">Kriterium</th>
                    {selectedApartments.map((a) => (
                      <th
                        key={a.id}
                        colSpan={members.length}
                        className="p-3 text-center border-l border-pn-border"
                      >
                        {a.title}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-t border-pn-border">
                    <th className="p-2 sticky left-0 bg-pn-bg-subtle" />
                    {selectedApartments.map((a) =>
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
                      {selectedApartments.map((a) =>
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
        </>
      )}
    </div>
  );
}
