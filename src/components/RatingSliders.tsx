"use client";

import { useState, useTransition } from "react";
import { saveRatingAction } from "@/app/actions";
import { ScoreBadge } from "@/components/ScoreBadge";
import { ScoreLegend } from "@/components/ScoreLegend";
import { apartmentScore, type CriterionInput } from "@/lib/scoring";
type Criterion = {
  id: string;
  name: string;
  weight: number;
  isDealbreaker: boolean;
  rating?: { score: number | null; note: string | null };
};

type Group = { id: string; name: string; criteria: Criterion[] };

type PartnerRating = {
  criterionId: string;
  score: number | null;
  note: string | null;
};

type Partner = {
  userId: string;
  name: string;
  ratings: PartnerRating[];
  score: number;
  dealbreaker: boolean;
  rated: number;
};

export function RatingSliders({
  apartmentId,
  groups,
  partners,
  criteriaFlat,
  myUserId,
  dealbreakerThreshold,
}: {
  apartmentId: string;
  groups: Group[];
  partners: Partner[];
  criteriaFlat: CriterionInput[];
  myUserId: string;
  dealbreakerThreshold: number;
}) {
  const [scores, setScores] = useState<Record<string, number | null>>(() => {
    const init: Record<string, number | null> = {};
    for (const g of groups) {
      for (const c of g.criteria) {
        init[c.id] = c.rating?.score ?? null;
      }
    }
    return init;
  });
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of groups) {
      for (const c of g.criteria) {
        if (c.rating?.note) init[c.id] = c.rating.note;
      }
    }
    return init;
  });
  const [pending, startTransition] = useTransition();

  const myScore = apartmentScore(
    criteriaFlat,
    Object.entries(scores)
      .filter(([, v]) => v != null)
      .map(([criterionId, score]) => ({ criterionId, userId: myUserId, score })),
    myUserId,
    dealbreakerThreshold
  );

  function partnerRating(partner: Partner, criterionId: string) {
    return partner.ratings.find((r) => r.criterionId === criterionId);
  }

  function onChange(criterionId: string, score: number) {
    setScores((s) => ({ ...s, [criterionId]: score }));
    startTransition(() =>
      saveRatingAction(apartmentId, criterionId, score, notes[criterionId] || null)
    );
  }

  function onNoteBlur(criterionId: string) {
    const score = scores[criterionId];
    if (score == null) return;
    startTransition(() =>
      saveRatingAction(apartmentId, criterionId, score, notes[criterionId] || null)
    );
  }

  function isRated(criterionId: string) {
    return scores[criterionId] != null;
  }

  return (
    <div className="space-y-8">
      <ScoreLegend className="mb-1" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-2">
        <div className="bg-pn-bg-surface border border-pn-border rounded-xl p-4">
          <p className="text-xs font-semibold text-pn-text-tertiary uppercase mb-2">Meine Bewertung</p>
          <ScoreBadge score={myScore.score} dealbreaker={myScore.dealbreaker} />
          <p className="text-xs text-pn-text-tertiary mt-2">
            {myScore.rated}/{myScore.total} Kriterien
          </p>
        </div>
        {partners.map((p) => (
          <div
            key={p.userId}
            className="bg-pn-bg-surface border border-pn-border rounded-xl p-4"
          >
            <p className="text-xs font-semibold text-pn-text-tertiary uppercase mb-2">
              {p.name}
            </p>
            <ScoreBadge score={p.score} dealbreaker={p.dealbreaker} />
            <p className="text-xs text-pn-text-tertiary mt-2">
              {p.rated}/{criteriaFlat.length} Kriterien
            </p>
          </div>
        ))}
      </div>

      {groups.map((g) => (
        <section key={g.id}>
          <h3 className="text-sm font-semibold text-pn-text-secondary uppercase tracking-wide mb-3">
            {g.name}{" "}
            <span className="text-pn-text-tertiary font-normal">
              {g.criteria.filter((c) => isRated(c.id)).length}/{g.criteria.length}
            </span>
          </h3>
          <ul className="space-y-4">
            {g.criteria.map((c) => (
              <li key={c.id} className="bg-pn-bg-surface border border-pn-border rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="font-medium">
                    {c.name}
                    {c.isDealbreaker && (
                      <span className="ml-2 text-xs text-pn-score-low font-semibold">dealbreaker</span>
                    )}
                  </span>
                  <span className="text-sm text-pn-text-tertiary">Gewicht {c.weight}</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-pn-text-tertiary mb-1">Ich</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={10}
                        step={1}
                        value={scores[c.id] ?? 0}
                        disabled={pending}
                        onChange={(e) => onChange(c.id, parseInt(e.target.value, 10))}
                        className="flex-1 accent-pn-accent"
                      />
                      <span className="w-8 text-center font-bold tabular-nums">
                        {scores[c.id] == null ? "—" : scores[c.id]}
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Notiz (optional)"
                      value={notes[c.id] ?? ""}
                      disabled={pending}
                      onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                      onBlur={() => onNoteBlur(c.id)}
                      className="mt-2 w-full border border-pn-border rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>

                  {partners.map((p) => {
                    const pr = partnerRating(p, c.id);
                    return (
                      <div key={p.userId} className="border-t border-pn-border pt-2">
                        <p className="text-xs text-pn-text-tertiary mb-1">{p.name}</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {pr?.score == null ? "—" : pr.score}
                          <span className="font-normal text-pn-text-tertiary"> / 10</span>
                        </p>
                        {pr?.note && (
                          <p className="text-xs text-pn-text-secondary mt-1">{pr.note}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
