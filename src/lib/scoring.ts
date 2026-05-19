export type CriterionInput = {
  id: string;
  weight: number;
  isDealbreaker: boolean;
};

export type RatingInput = {
  criterionId: string;
  score: number | null;
};

export const DEFAULT_DEALBREAKER_THRESHOLD = 3;
export const MIN_DEALBREAKER_THRESHOLD = 0;
export const MAX_DEALBREAKER_THRESHOLD = 10;

export function parseDealbreakerThreshold(raw: string | number | null | undefined): number {
  const value =
    typeof raw === "number" ? raw : parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(value)) return DEFAULT_DEALBREAKER_THRESHOLD;
  if (value < MIN_DEALBREAKER_THRESHOLD || value > MAX_DEALBREAKER_THRESHOLD) {
    return DEFAULT_DEALBREAKER_THRESHOLD;
  }
  return value;
}

export function resolveDealbreakerThreshold(value: number | null | undefined): number {
  if (value == null) return DEFAULT_DEALBREAKER_THRESHOLD;
  return parseDealbreakerThreshold(value);
}

export function apartmentScore(
  criteria: CriterionInput[],
  ratings: { criterionId: string; userId: string; score: number | null }[],
  userId: string,
  dealbreakerThreshold: number = DEFAULT_DEALBREAKER_THRESHOLD
) {
  const userRatings: RatingInput[] = ratings
    .filter((r) => r.userId === userId)
    .map((r) => ({ criterionId: r.criterionId, score: r.score }));
  return computeScore(criteria, userRatings, dealbreakerThreshold);
}

export function computeScore(
  criteria: CriterionInput[],
  ratings: RatingInput[],
  dealbreakerThreshold: number = DEFAULT_DEALBREAKER_THRESHOLD
): { score: number; dealbreaker: boolean; rated: number; total: number } {
  const threshold = parseDealbreakerThreshold(dealbreakerThreshold);
  const ratingMap = new Map(ratings.map((r) => [r.criterionId, r.score]));
  let weightedSum = 0;
  let weightTotal = 0;
  let rated = 0;
  let dealbreaker = false;

  for (const c of criteria) {
    const raw = ratingMap.get(c.id);
    if (raw === null || raw === undefined) continue;
    rated += 1;
    if (c.isDealbreaker && raw <= threshold) {
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

export function formatPricePerSqm(
  price: number | null | undefined,
  sizeSqm: number | null | undefined
): string {
  if (price == null || sizeSqm == null || sizeSqm <= 0) return "—";
  const perSqm = Math.round(price / sizeSqm);
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(perSqm)} €/m²`;
}

export type ApartmentSortKey = "score" | "price" | "ppp" | "date";
export type ApartmentSortOrder = "asc" | "desc";

export const DEFAULT_APARTMENT_SORT: ApartmentSortKey = "score";
export const DEFAULT_APARTMENT_SORT_ORDER: ApartmentSortOrder = "desc";

export function parseApartmentSort(value: string | undefined): ApartmentSortKey {
  if (value === "price" || value === "ppp" || value === "date") return value;
  return DEFAULT_APARTMENT_SORT;
}

export function parseApartmentSortOrder(value: string | undefined): ApartmentSortOrder {
  if (value === "asc") return "asc";
  return DEFAULT_APARTMENT_SORT_ORDER;
}

function compareApartments<
  T extends { score: number; price: number | null; createdAt: Date },
>(a: T, b: T, sort: ApartmentSortKey): number {
  switch (sort) {
    case "price": {
      if (a.price == null && b.price == null) return 0;
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return a.price - b.price;
    }
    case "ppp": {
      const pa = a.price != null && a.score > 0 ? a.price / a.score : Number.POSITIVE_INFINITY;
      const pb = b.price != null && b.score > 0 ? b.price / b.score : Number.POSITIVE_INFINITY;
      return pa - pb;
    }
    case "date":
      return a.createdAt.getTime() - b.createdAt.getTime();
    default:
      return a.score - b.score;
  }
}

export function sortApartments<
  T extends { score: number; price: number | null; createdAt: Date },
>(items: T[], sort: ApartmentSortKey, order: ApartmentSortOrder = DEFAULT_APARTMENT_SORT_ORDER): T[] {
  const copy = [...items];
  return copy.sort((a, b) => {
    const base = compareApartments(a, b, sort);
    return order === "asc" ? base : -base;
  });
}

export function budgetDelta(
  price: number | null | undefined,
  budget: number | null | undefined
): { pct: number; over: boolean } | null {
  if (price == null || budget == null || budget <= 0) return null;
  const pct = Math.round(((price - budget) / budget) * 100);
  return { pct, over: price > budget };
}

export function formatBudgetHint(price: number, budget: number): string {
  const delta = budgetDelta(price, budget);
  if (!delta) return "";
  if (delta.pct === 0) return "Im Budget";
  if (delta.over) return `${delta.pct} % über Budget`;
  return `${Math.abs(delta.pct)} % unter Budget`;
}
