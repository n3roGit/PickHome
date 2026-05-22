import type { ListingPreviewFields } from "@/lib/listing-import";
import type { ListingPreviewFieldKey } from "@/lib/listing-import-form";

export type ApartmentListingDraft = {
  fields: ListingPreviewFields;
  pending: ListingPreviewFieldKey[];
};

export type ApartmentListingSavedFlags = {
  title?: boolean;
  description?: boolean;
  basics?: boolean;
  broker?: boolean;
};

const STORAGE_PREFIX = "pickhome-listing-draft:";

/** Fields stored via Preis & Adresse / updateApartmentBasicsAction */
const BASICS_FIELD_KEYS: ListingPreviewFieldKey[] = [
  "price",
  "address",
  "sizeSqm",
  "plotSizeSqm",
  "energyClass",
  "hoaFeeMonthly",
  "heatingCostMonthly",
  "propertyTaxAnnual",
  "renovationCost",
];

export function apartmentListingDraftStorageKey(apartmentId: string): string {
  return `${STORAGE_PREFIX}${apartmentId}`;
}

export function keysForSavedFlags(flags: ApartmentListingSavedFlags): ListingPreviewFieldKey[] {
  const keys: ListingPreviewFieldKey[] = [];
  if (flags.title) keys.push("title");
  if (flags.description) keys.push("description");
  if (flags.basics) keys.push(...BASICS_FIELD_KEYS);
  if (flags.broker) keys.push("brokerInvolved");
  return keys;
}

export function pruneApartmentListingDraft(
  draft: ApartmentListingDraft,
  flags: ApartmentListingSavedFlags
): ApartmentListingDraft | null {
  const remove = new Set(keysForSavedFlags(flags));
  const pending = draft.pending.filter((k) => !remove.has(k));
  if (pending.length === 0) return null;
  return { fields: draft.fields, pending };
}

export function readApartmentListingDraft(apartmentId: string): ApartmentListingDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(apartmentListingDraftStorageKey(apartmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApartmentListingDraft;
    if (!parsed?.pending?.length || !parsed.fields) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeApartmentListingDraft(
  apartmentId: string,
  draft: ApartmentListingDraft | null
): void {
  if (typeof sessionStorage === "undefined") return;
  const key = apartmentListingDraftStorageKey(apartmentId);
  if (!draft || draft.pending.length === 0) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, JSON.stringify(draft));
}

export function mergeApartmentListingDraft(
  apartmentId: string,
  fields: ListingPreviewFields,
  filled: ListingPreviewFieldKey[]
): void {
  if (filled.length === 0) return;
  const existing = readApartmentListingDraft(apartmentId);
  const pending = [...new Set([...(existing?.pending ?? []), ...filled])];
  const mergedFields: ListingPreviewFields = { ...(existing?.fields ?? {}), ...fields };
  writeApartmentListingDraft(apartmentId, { fields: mergedFields, pending });
}

export const APARTMENT_DRAFT_RESTORED_EVENT = "pickhome-apartment-draft-restored";
