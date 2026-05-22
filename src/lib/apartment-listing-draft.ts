import type { ListingPreviewFields } from "@/lib/listing-import";
import type { ListingPreviewFieldKey } from "@/lib/listing-import-form";

export type ApartmentListingDraft = {
  fields: ListingPreviewFields;
  pending: ListingPreviewFieldKey[];
  /** Filled fields where KI value differs — shown as optional Übernehmen hints. */
  suggestionKeys?: ListingPreviewFieldKey[];
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

function pickDraftFieldValues(
  fields: ListingPreviewFields,
  keys: ListingPreviewFieldKey[]
): ListingPreviewFields {
  return keys.reduce<ListingPreviewFields>((picked, key) => {
    if (fields[key] === undefined) return picked;
    return { ...picked, [key]: fields[key] } as ListingPreviewFields;
  }, {});
}

export function pruneApartmentListingDraft(
  draft: ApartmentListingDraft,
  flags: ApartmentListingSavedFlags
): ApartmentListingDraft | null {
  const remove = new Set(keysForSavedFlags(flags));
  const pending = draft.pending.filter((k) => !remove.has(k));
  const suggestionKeys = (draft.suggestionKeys ?? []).filter((k) => !remove.has(k));
  if (pending.length === 0 && suggestionKeys.length === 0) return null;
  const activeKeys = [...new Set([...pending, ...suggestionKeys])];
  return {
    fields: pickDraftFieldValues(draft.fields, activeKeys),
    pending,
    suggestionKeys,
  };
}

export function readApartmentListingDraft(apartmentId: string): ApartmentListingDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(apartmentListingDraftStorageKey(apartmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApartmentListingDraft;
    if (!parsed?.fields) return null;
    const hasPending = (parsed.pending?.length ?? 0) > 0;
    const hasSuggestions = (parsed.suggestionKeys?.length ?? 0) > 0;
    if (!hasPending && !hasSuggestions) return null;
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
  if (
    !draft ||
    (draft.pending.length === 0 && (draft.suggestionKeys?.length ?? 0) === 0)
  ) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, JSON.stringify(draft));
}

export function mergeApartmentListingDraft(
  apartmentId: string,
  fields: ListingPreviewFields,
  filled: ListingPreviewFieldKey[],
  suggestionKeys: ListingPreviewFieldKey[] = []
): void {
  if (filled.length === 0 && suggestionKeys.length === 0) return;
  const existing = readApartmentListingDraft(apartmentId);
  const pending = [...new Set([...(existing?.pending ?? []), ...filled])];
  const mergedSuggestions = [
    ...new Set([...(existing?.suggestionKeys ?? []), ...suggestionKeys]),
  ].filter((k) => !pending.includes(k));
  const mergedFields: ListingPreviewFields = { ...(existing?.fields ?? {}), ...fields };
  writeApartmentListingDraft(apartmentId, {
    fields: mergedFields,
    pending,
    suggestionKeys: mergedSuggestions,
  });
}

export function acceptListingDraftSuggestion(
  apartmentId: string,
  key: ListingPreviewFieldKey
): void {
  const draft = readApartmentListingDraft(apartmentId);
  if (!draft) return;
  const suggestionKeys = (draft.suggestionKeys ?? []).filter((k) => k !== key);
  const pending = [...new Set([...draft.pending, key])];
  writeApartmentListingDraft(apartmentId, {
    ...draft,
    pending,
    suggestionKeys,
  });
}

export function removeListingDraftSuggestion(
  apartmentId: string,
  key: ListingPreviewFieldKey
): void {
  const draft = readApartmentListingDraft(apartmentId);
  if (!draft?.suggestionKeys?.length) return;
  const suggestionKeys = draft.suggestionKeys.filter((k) => k !== key);
  if (suggestionKeys.length === 0 && draft.pending.length === 0) {
    writeApartmentListingDraft(apartmentId, null);
    return;
  }
  writeApartmentListingDraft(apartmentId, { ...draft, suggestionKeys });
}

export const APARTMENT_DRAFT_RESTORED_EVENT = "pickhome-apartment-draft-restored";
