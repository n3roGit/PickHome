"use client";

import type { PartnerComparison } from "@/lib/rating-divergence";
import { isNotableDivergence } from "@/lib/rating-divergence";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ScoreBadge } from "@/components/ScoreBadge";

export function PartnerDivergencePanel({
  comparisons,
  compact = false,
}: {
  comparisons: PartnerComparison[];
  compact?: boolean;
}) {
  if (comparisons.length === 0) return null;

  const hasAnyRating = comparisons.some((c) => c.partner.rated > 0);
  if (!hasAnyRating) return null;

  if (compact) {
    const notable = comparisons.filter(isNotableDivergence);
    if (notable.length === 0) return null;
    const top = notable.reduce((best, c) => (c.delta > best.delta ? c : best));
    return (
      <span
        className="inline-flex items-center text-xs font-medium text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-900/40 px-2 py-0.5 rounded-full shrink-0"
        title={`Abweichung zu ${top.partnerName}: ${top.my.displayScore} vs ${top.partner.displayScore}`}
      >
        Δ {top.delta}
      </span>
    );
  }

  return (
    <CollapsibleSection title="Meinungsunterschiede" defaultOpen>
      <ul className="space-y-4">
        {comparisons.map((c) => (
          <li key={c.partnerUserId} className="border border-pn-border rounded-lg p-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-sm text-pn-text-secondary">Du</span>
              <ScoreBadge
                score={c.my.score}
                displayScore={c.my.displayScore}
                dealbreaker={c.my.dealbreaker}
              />
              <span className="text-sm text-pn-text-tertiary">·</span>
              <span className="text-sm text-pn-text-secondary">{c.partnerName}</span>
              <ScoreBadge
                score={c.partner.score}
                displayScore={c.partner.displayScore}
                dealbreaker={c.partner.dealbreaker}
              />
              {isNotableDivergence(c) && (
                <span className="text-xs font-medium text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                  Δ {c.delta}
                </span>
              )}
            </div>
            {c.topDivergentCriteria.length > 0 ? (
              <ul className="text-sm text-pn-text-secondary space-y-1">
                {c.topDivergentCriteria.map((row) => (
                  <li key={row.criterionId}>
                    <span className="font-medium text-pn-text-primary">{row.name}</span>:{" "}
                    du {row.myScore} · {c.partnerName} {row.partnerScore}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-pn-text-tertiary">
                Noch keine gemeinsam bewerteten Kriterien.
              </p>
            )}
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );
}

export function PartnerDivergenceCompareBlock({
  apartmentTitle,
  comparisons,
}: {
  apartmentTitle: string;
  comparisons: PartnerComparison[];
}) {
  const notable = comparisons.filter(isNotableDivergence);
  if (notable.length === 0) return null;

  return (
    <div className="text-sm border border-pn-border rounded-lg p-3">
      <p className="font-medium mb-2">{apartmentTitle}</p>
      <ul className="space-y-2 text-pn-text-secondary">
        {notable.map((c) => (
          <li key={c.partnerUserId}>
            Du {c.my.displayScore} · {c.partnerName} {c.partner.displayScore}
            {c.topDivergentCriteria[0] && (
              <span className="block text-xs text-pn-text-tertiary mt-0.5">
                Größter Unterschied: {c.topDivergentCriteria[0].name} ({c.topDivergentCriteria[0].myScore}{" "}
                vs {c.topDivergentCriteria[0].partnerScore})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
