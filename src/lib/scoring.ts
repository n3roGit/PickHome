export type CriterionInput = {
  id: string;
  weight: number;
  isDealbreaker: boolean;
};

export type RatingInput = {
  criterionId: string;
  score: number | null;
};

const DEALBREAKER_THRESHOLD = 3;

export function computeScore(
  criteria: CriterionInput[],
  ratings: RatingInput[]
): { score: number; dealbreaker: boolean; rated: number; total: number } {
  const ratingMap = new Map(ratings.map((r) => [r.criterionId, r.score]));
  let weightedSum = 0;
  let weightTotal = 0;
  let rated = 0;
  let dealbreaker = false;

  for (const c of criteria) {
    const raw = ratingMap.get(c.id);
    if (raw === null || raw === undefined) continue;
    rated += 1;
    if (c.isDealbreaker && raw <= DEALBREAKER_THRESHOLD) {
      dealbreaker = true;
    }
    weightedSum += c.weight * (raw / 10);
    weightTotal += c.weight;
  }

  const total = criteria.length;
  if (weightTotal === 0) {
    return { score: 0, dealbreaker, rated, total };
  }
  if (dealbreaker) {
    return { score: 0, dealbreaker: true, rated, total };
  }
  const score = Math.round((weightedSum / weightTotal) * 100);
  return { score, dealbreaker: false, rated, total };
}

export function scoreColor(score: number, dealbreaker: boolean): "high" | "mid" | "low" {
  if (dealbreaker || score <= 40) return "low";
  if (score >= 71) return "high";
  return "mid";
}

export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents);
}

export function pricePerPoint(price: number | null | undefined, score: number): string | null {
  if (!price || score <= 0) return null;
  const perPoint = Math.round(price / score);
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(perPoint);
}
