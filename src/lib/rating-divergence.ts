import { apartmentScore, type CriterionInput } from "@/lib/scoring";

export const DIVERGENCE_DELTA_THRESHOLD = 15;
export const DIVERGENCE_MIN_RATED_FRACTION = 0.5;
export const TOP_DIVERGENT_CRITERIA = 5;

export type ScoreSummary = {
  score: number;
  displayScore: number;
  dealbreaker: boolean;
  rated: number;
  total: number;
};

export type DivergentCriterion = {
  criterionId: string;
  name: string;
  myScore: number;
  partnerScore: number;
  delta: number;
};

export type PartnerComparison = {
  partnerUserId: string;
  partnerName: string;
  my: ScoreSummary;
  partner: ScoreSummary;
  delta: number;
  topDivergentCriteria: DivergentCriterion[];
};

type RatingRow = {
  apartmentId: string;
  userId: string;
  criterionId: string;
  score: number | null;
};

type CriterionWithName = CriterionInput & { name: string };

export function partnerComparisons(input: {
  criteria: CriterionWithName[];
  ratings: RatingRow[];
  apartmentId: string;
  currentUserId: string;
  partners: { userId: string; name: string }[];
  dealbreakerThreshold: number;
}): PartnerComparison[] {
  const { criteria, ratings, apartmentId, currentUserId, partners, dealbreakerThreshold } =
    input;
  const aptRatings = ratings.filter((r) => r.apartmentId === apartmentId);

  return partners
    .filter((p) => p.userId !== currentUserId)
    .map((p) => {
      const my = apartmentScore(criteria, aptRatings, currentUserId, dealbreakerThreshold);
      const partner = apartmentScore(criteria, aptRatings, p.userId, dealbreakerThreshold);
      const delta = Math.abs(my.displayScore - partner.displayScore);

      const topDivergentCriteria: DivergentCriterion[] = [];
      for (const c of criteria) {
        const myR = aptRatings.find(
          (r) => r.criterionId === c.id && r.userId === currentUserId
        );
        const partnerR = aptRatings.find(
          (r) => r.criterionId === c.id && r.userId === p.userId
        );
        if (myR?.score == null || partnerR?.score == null) continue;
        topDivergentCriteria.push({
          criterionId: c.id,
          name: c.name,
          myScore: myR.score,
          partnerScore: partnerR.score,
          delta: Math.abs(myR.score - partnerR.score),
        });
      }
      topDivergentCriteria.sort((a, b) => b.delta - a.delta);

      return {
        partnerUserId: p.userId,
        partnerName: p.name,
        my,
        partner,
        delta,
        topDivergentCriteria: topDivergentCriteria.slice(0, TOP_DIVERGENT_CRITERIA),
      };
    });
}

export function isNotableDivergence(comparison: PartnerComparison): boolean {
  const minRated = Math.ceil(comparison.my.total * DIVERGENCE_MIN_RATED_FRACTION);
  if (comparison.my.rated < minRated || comparison.partner.rated < minRated) {
    return false;
  }
  return comparison.delta >= DIVERGENCE_DELTA_THRESHOLD;
}

export function maxNotableDivergence(comparisons: PartnerComparison[]): PartnerComparison | null {
  const notable = comparisons.filter(isNotableDivergence);
  if (notable.length === 0) return null;
  return notable.reduce((best, c) => (c.delta > best.delta ? c : best));
}
