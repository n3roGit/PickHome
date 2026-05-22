import {
  acceptListingDraftSuggestion,
  readApartmentListingDraft,
  removeListingDraftSuggestion,
} from "@/lib/apartment-listing-draft";
import type { ListingPreviewFields } from "@/lib/listing-import";
import {
  apartmentBasicsFormId,
  apartmentBrokerFormId,
  apartmentDescriptionFormId,
  apartmentTitleFormId,
  applyListingPreviewFieldKey,
  type ListingPreviewFieldKey,
} from "@/lib/listing-import-form";
import { formatPrice } from "@/lib/scoring";

export const LISTING_SUGGESTIONS_UPDATED_EVENT = "pickhome-listing-suggestions-updated";

export const LISTING_SUGGESTION_CLASS = "pn-listing-suggestion";

export type ListingFieldSuggestion = {
  key: ListingPreviewFieldKey;
  displayValue: string;
};

function fieldInput(
  root: ParentNode,
  key: ListingPreviewFieldKey
): HTMLInputElement | HTMLTextAreaElement | null {
  const name = key === "brokerInvolved" ? "brokerInvolved" : key;
  const el = root.querySelector(`[name="${name}"]`);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el;
  }
  return null;
}

function rootsForApartment(apartmentId: string): ParentNode[] {
  if (typeof document === "undefined") return [];
  const page = document.getElementById(`apartment-page-${apartmentId}`);
  if (!page) return [];
  const roots: ParentNode[] = [page];
  for (const id of [
    apartmentBasicsFormId(apartmentId),
    apartmentTitleFormId(apartmentId),
    apartmentDescriptionFormId(apartmentId),
    apartmentBrokerFormId(apartmentId),
  ]) {
    const el = document.getElementById(id);
    if (el) roots.push(el);
  }
  return roots;
}

export function readCurrentListingFieldValues(
  apartmentId: string
): Partial<Record<ListingPreviewFieldKey, string | boolean>> {
  const values: Partial<Record<ListingPreviewFieldKey, string | boolean>> = {};
  for (const root of rootsForApartment(apartmentId)) {
    for (const key of [
      "title",
      "price",
      "address",
      "sizeSqm",
      "plotSizeSqm",
      "energyClass",
      "description",
      "hoaFeeMonthly",
      "heatingCostMonthly",
      "propertyTaxAnnual",
      "renovationCost",
      "brokerInvolved",
    ] as const) {
      if (values[key] !== undefined) continue;
      if (key === "brokerInvolved") {
        const el = fieldInput(root, key);
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
          values[key] = el.checked;
        }
        continue;
      }
      const el = fieldInput(root, key);
      if (el) values[key] = el.value;
    }
  }
  return values;
}

function parseNumericField(raw: string | boolean | undefined): number | undefined {
  if (typeof raw !== "string") return undefined;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeEnergyClass(raw: string | boolean | undefined): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim().toUpperCase();
  if (t === "A++") return "A+";
  return t;
}

function valuesEqual(
  key: ListingPreviewFieldKey,
  current: string | boolean | undefined,
  proposed: ListingPreviewFields[ListingPreviewFieldKey]
): boolean {
  if (proposed === undefined || proposed === null || proposed === "") return true;

  if (key === "brokerInvolved") {
    if (typeof proposed !== "boolean") return true;
    const cur = current === true;
    return cur === proposed;
  }

  if (typeof proposed === "number") {
    const curNum = parseNumericField(current);
    return curNum === proposed;
  }

  if (typeof proposed === "string") {
    const curStr = typeof current === "string" ? current.trim() : "";
    if (!curStr) return false;
    if (key === "energyClass") {
      return normalizeEnergyClass(curStr) === normalizeEnergyClass(proposed);
    }
    return curStr.localeCompare(proposed.trim(), "de", { sensitivity: "accent" }) === 0;
  }

  return true;
}

function isCurrentEmpty(
  key: ListingPreviewFieldKey,
  current: string | boolean | undefined
): boolean {
  if (key === "brokerInvolved") {
    return current !== true;
  }
  if (typeof current !== "string") return true;
  return current.trim() === "";
}

export function formatListingSuggestionValue(
  key: ListingPreviewFieldKey,
  fields: ListingPreviewFields
): string | null {
  const v = fields[key];
  if (v === undefined || v === null || v === "") return null;

  if (key === "brokerInvolved") {
    return typeof v === "boolean" ? (v ? "Mit Makler" : "Ohne Makler") : null;
  }
  if (key === "price") {
    return typeof v === "number" ? formatPrice(v) : null;
  }
  if (
    key === "hoaFeeMonthly" ||
    key === "heatingCostMonthly" ||
    key === "propertyTaxAnnual" ||
    key === "renovationCost"
  ) {
    return typeof v === "number" ? formatPrice(v) : null;
  }
  if (key === "sizeSqm" || key === "plotSizeSqm") {
    return typeof v === "number" ? `${v} m²` : null;
  }
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : null;
  }
  if (typeof v === "number") {
    return String(v);
  }
  return null;
}

/** Fields that have a value in the form and differ from the KI extract (not auto-filled). */
export function computeListingFieldSuggestions(
  apartmentId: string,
  proposed: ListingPreviewFields
): ListingFieldSuggestion[] {
  const current = readCurrentListingFieldValues(apartmentId);
  const suggestions: ListingFieldSuggestion[] = [];

  for (const key of [
    "title",
    "price",
    "address",
    "sizeSqm",
    "plotSizeSqm",
    "energyClass",
    "description",
    "hoaFeeMonthly",
    "heatingCostMonthly",
    "propertyTaxAnnual",
    "renovationCost",
    "brokerInvolved",
  ] as const) {
    const prop = proposed[key];
    if (prop === undefined || prop === null || prop === "") continue;
    if (isCurrentEmpty(key, current[key])) continue;
    if (valuesEqual(key, current[key], prop)) continue;
    const displayValue = formatListingSuggestionValue(key, proposed);
    if (!displayValue) continue;
    suggestions.push({ key, displayValue });
  }

  return suggestions;
}

export function clearListingFieldSuggestions(root: ParentNode = document) {
  root.querySelectorAll(`.${LISTING_SUGGESTION_CLASS}`).forEach((el) => el.remove());
}

function mountPointForField(input: HTMLElement): HTMLElement | null {
  const label = input.closest("label");
  if (label) return label;
  const block = input.closest(".block");
  if (block instanceof HTMLElement) return block;
  return input.parentElement;
}

export function mountListingFieldSuggestions(
  apartmentId: string,
  suggestions: ListingFieldSuggestion[],
  fields: ListingPreviewFields,
  options?: { onChange?: () => void }
) {
  const page = document.getElementById(`apartment-page-${apartmentId}`);
  if (!page) return;
  clearListingFieldSuggestions(page);

  for (const s of suggestions) {
    let input: HTMLInputElement | HTMLTextAreaElement | null = null;
    for (const root of rootsForApartment(apartmentId)) {
      const el = fieldInput(root, s.key);
      if (el) {
        input = el;
        break;
      }
    }
    if (!input) continue;

    const host = mountPointForField(input);
    if (!host) continue;

    const row = document.createElement("div");
    row.className = `${LISTING_SUGGESTION_CLASS} mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs`;
    row.dataset.fieldKey = s.key;

    const text = document.createElement("span");
    text.className = "text-pn-text-secondary";
    text.textContent = `KI-Vorschlag: ${s.displayValue}`;

    const accept = document.createElement("button");
    accept.type = "button";
    accept.className =
      "text-pn-accent font-medium hover:underline shrink-0";
    accept.textContent = "Übernehmen";

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className =
      "text-pn-text-tertiary hover:text-pn-text-secondary shrink-0";
    dismiss.textContent = "Verwerfen";

    accept.addEventListener("click", () => {
      applyListingPreviewFieldKey(apartmentId, s.key, fields, { highlight: true });
      acceptListingDraftSuggestion(apartmentId, s.key);
      row.remove();
      options?.onChange?.();
    });

    dismiss.addEventListener("click", () => {
      removeListingDraftSuggestion(apartmentId, s.key);
      row.remove();
      options?.onChange?.();
    });

    row.append(text, accept, dismiss);
    host.appendChild(row);
  }
}

export function dispatchListingSuggestionsUpdated(apartmentId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LISTING_SUGGESTIONS_UPDATED_EVENT, { detail: { apartmentId } })
  );
}

let syncSuggestionsInProgress = false;

export function syncListingFieldSuggestionsFromDraft(apartmentId: string) {
  if (syncSuggestionsInProgress) return;
  syncSuggestionsInProgress = true;
  try {
    syncListingFieldSuggestionsFromDraftInner(apartmentId);
  } finally {
    syncSuggestionsInProgress = false;
  }
}

function syncListingFieldSuggestionsFromDraftInner(apartmentId: string) {
  const draft = readApartmentListingDraft(apartmentId);
  const page = document.getElementById(`apartment-page-${apartmentId}`);
  if (!page) return;

  if (!draft?.suggestionKeys?.length) {
    clearListingFieldSuggestions(page);
    return;
  }

  const suggestions: ListingFieldSuggestion[] = [];
  for (const key of draft.suggestionKeys) {
    const displayValue = formatListingSuggestionValue(key, draft.fields);
    if (!displayValue) continue;
    const current = readCurrentListingFieldValues(apartmentId);
    if (isCurrentEmpty(key, current[key])) continue;
    if (valuesEqual(key, current[key], draft.fields[key])) continue;
    suggestions.push({ key, displayValue });
  }

  mountListingFieldSuggestions(apartmentId, suggestions, draft.fields, {
    onChange: () => syncListingFieldSuggestionsFromDraftInner(apartmentId),
  });
}
