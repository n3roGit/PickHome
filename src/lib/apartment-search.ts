import { formatDateDe, formatDateTimeDe } from "@/lib/dates";

export type ApartmentSearchInput = {
  title: string;
  address?: string | null;
  description?: string | null;
  listingUrl?: string | null;
  price?: number | null;
  sizeSqm?: number | null;
  floor?: number | null;
  yearBuilt?: number | null;
  brokerInvolved?: boolean;
  photos?: { caption?: string | null }[];
  documents?: { fileName: string }[];
  viewings?: { note?: string | null; scheduledAt: Date }[];
  ratings?: { criterionId: string; score?: number | null; note?: string | null }[];
};

export function normalizeSearchQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function buildApartmentSearchBlob(
  apartment: ApartmentSearchInput,
  criterionNames: Map<string, string>
): string {
  const parts: string[] = [apartment.title];

  const push = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    parts.push(String(value));
  };

  push(apartment.address);
  push(apartment.description);
  push(apartment.listingUrl);
  push(apartment.price);
  push(apartment.sizeSqm);
  push(apartment.floor);
  push(apartment.yearBuilt);
  if (apartment.brokerInvolved) parts.push("makler");

  for (const photo of apartment.photos ?? []) {
    push(photo.caption);
  }
  for (const doc of apartment.documents ?? []) {
    push(doc.fileName);
  }
  for (const viewing of apartment.viewings ?? []) {
    push(viewing.note);
    push(formatDateDe(viewing.scheduledAt));
    push(formatDateTimeDe(viewing.scheduledAt));
  }
  for (const rating of apartment.ratings ?? []) {
    const criterion = criterionNames.get(rating.criterionId);
    push(criterion);
    push(rating.note);
    if (rating.score != null) push(rating.score);
  }

  return parts.join("\n").toLowerCase();
}

export function matchesApartmentSearch(blob: string, query: string): boolean {
  const tokens = normalizeSearchQuery(query);
  if (tokens.length === 0) return true;
  return tokens.every((token) => blob.includes(token));
}

export function filterApartmentsBySearch<T extends ApartmentSearchInput>(
  apartments: T[],
  query: string,
  criterionNames: Map<string, string>
): T[] {
  const trimmed = query.trim();
  if (!trimmed) return apartments;
  return apartments.filter((apartment) =>
    matchesApartmentSearch(buildApartmentSearchBlob(apartment, criterionNames), trimmed)
  );
}
