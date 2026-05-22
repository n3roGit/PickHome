import type { ListingPreviewFields } from "@/lib/listing-import";

export type ListingPreviewFieldKey =
  | "title"
  | "price"
  | "address"
  | "sizeSqm"
  | "plotSizeSqm"
  | "energyClass"
  | "description"
  | "brokerInvolved"
  | "hoaFeeMonthly"
  | "heatingCostMonthly"
  | "propertyTaxAnnual"
  | "renovationCost";

export const LISTING_PREVIEW_FIELD_LABELS: Record<ListingPreviewFieldKey, string> = {
  title: "Anzeigename",
  price: "Preis",
  address: "Adresse",
  sizeSqm: "Wohnfläche",
  plotSizeSqm: "Grundstücksfläche",
  energyClass: "Energieklasse",
  description: "Beschreibung",
  brokerInvolved: "Makler",
  hoaFeeMonthly: "Hausgeld",
  heatingCostMonthly: "Heizkosten",
  propertyTaxAnnual: "Grundsteuer",
  renovationCost: "Sanierung",
};

import { UNSAVED_SECTION_CLASS } from "@/lib/unsaved-guard";

export { UNSAVED_SECTION_CLASS };
export const PREFILLED_FIELD_CLASS = "pn-field-prefilled";

export function apartmentBasicsFormId(apartmentId: string) {
  return `apartment-basics-${apartmentId}`;
}

export function apartmentListingUrlFormId(apartmentId: string) {
  return `apartment-listing-url-${apartmentId}`;
}

export function apartmentTitleFormId(apartmentId: string) {
  return `apartment-title-${apartmentId}`;
}

export function apartmentDescriptionFormId(apartmentId: string) {
  return `apartment-description-${apartmentId}`;
}

export function apartmentNotesFormId(apartmentId: string) {
  return `apartment-notes-${apartmentId}`;
}

export function apartmentBrokerFormId(apartmentId: string) {
  return `apartment-broker-${apartmentId}`;
}

function setNamedField(
  root: ParentNode,
  name: string,
  value: string | number | undefined,
  onlyEmpty: boolean
): boolean {
  if (value == null || value === "") return false;
  const el = root.querySelector(`[name="${name}"]`) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;
  if (!el) return false;
  if (onlyEmpty && el.value.trim() !== "") return false;
  el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function setBrokerCheckbox(
  root: ParentNode,
  value: boolean | undefined,
  onlyEmpty: boolean
): boolean {
  if (value == null) return false;
  const el = root.querySelector('[name="brokerInvolved"]') as HTMLInputElement | null;
  if (!el || el.type !== "checkbox") return false;
  if (onlyEmpty && el.checked) return false;
  el.checked = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function highlightField(root: ParentNode, name: string) {
  const el = root.querySelector(`[name="${name}"]`) as HTMLElement | null;
  if (el) el.classList.add(PREFILLED_FIELD_CLASS);
}

function highlightBrokerCheckbox(root: ParentNode) {
  const el = root.querySelector('[name="brokerInvolved"]') as HTMLElement | null;
  if (el) el.classList.add(PREFILLED_FIELD_CLASS);
}

export function clearPrefilledHighlights(root: ParentNode = document) {
  root.querySelectorAll(`.${PREFILLED_FIELD_CLASS}`).forEach((el) => {
    el.classList.remove(PREFILLED_FIELD_CLASS);
  });
}

export function clearPrefilledHighlightsForKeys(
  root: ParentNode,
  keys: ListingPreviewFieldKey[]
) {
  for (const key of keys) {
    const name = key === "brokerInvolved" ? "brokerInvolved" : key;
    root.querySelector(`[name="${name}"]`)?.classList.remove(PREFILLED_FIELD_CLASS);
  }
}

export function highlightPrefilledFields(
  root: ParentNode,
  fields: ListingPreviewFieldKey[],
  options?: { clear?: boolean }
) {
  if (options?.clear !== false) clearPrefilledHighlights(root);
  for (const key of fields) {
    if (key === "brokerInvolved") {
      highlightBrokerCheckbox(root);
    } else {
      highlightField(root, key);
    }
  }
  const first = root.querySelector(`.${PREFILLED_FIELD_CLASS}`);
  if (first instanceof HTMLElement) {
    first.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

export function formatPrefilledFieldLabels(fields: ListingPreviewFieldKey[]): string {
  return fields.map((k) => LISTING_PREVIEW_FIELD_LABELS[k]).join(", ");
}

export function applyListingPreviewFields(
  form: HTMLFormElement,
  fields: ListingPreviewFields,
  options?: { onlyEmpty?: boolean }
): ListingPreviewFieldKey[] {
  const onlyEmpty = options?.onlyEmpty !== false;
  const filled: ListingPreviewFieldKey[] = [];

  if (setNamedField(form, "title", fields.title, onlyEmpty)) filled.push("title");
  if (setNamedField(form, "price", fields.price, onlyEmpty)) filled.push("price");
  if (setNamedField(form, "address", fields.address, onlyEmpty)) filled.push("address");
  if (setNamedField(form, "sizeSqm", fields.sizeSqm, onlyEmpty)) filled.push("sizeSqm");
  if (setNamedField(form, "plotSizeSqm", fields.plotSizeSqm, onlyEmpty))
    filled.push("plotSizeSqm");
  if (setNamedField(form, "energyClass", fields.energyClass, onlyEmpty))
    filled.push("energyClass");
  if (setNamedField(form, "hoaFeeMonthly", fields.hoaFeeMonthly, onlyEmpty))
    filled.push("hoaFeeMonthly");
  if (setNamedField(form, "heatingCostMonthly", fields.heatingCostMonthly, onlyEmpty))
    filled.push("heatingCostMonthly");
  if (setNamedField(form, "propertyTaxAnnual", fields.propertyTaxAnnual, onlyEmpty))
    filled.push("propertyTaxAnnual");
  if (setNamedField(form, "renovationCost", fields.renovationCost, onlyEmpty))
    filled.push("renovationCost");
  if (setNamedField(form, "description", fields.description, onlyEmpty))
    filled.push("description");
  if (setBrokerCheckbox(form, fields.brokerInvolved, onlyEmpty)) filled.push("brokerInvolved");

  return filled;
}

/** Fill basics, title, description, and broker blocks on the apartment detail page. */
export function applyListingPreviewToApartment(
  apartmentId: string,
  fields: ListingPreviewFields,
  options?: {
    onlyEmpty?: boolean;
    /** When set, only highlight these keys (after all values are applied). */
    highlightKeys?: ListingPreviewFieldKey[];
    clearHighlights?: boolean;
  }
): ListingPreviewFieldKey[] {
  const filled: ListingPreviewFieldKey[] = [];

  const basicsForm = document.getElementById(apartmentBasicsFormId(apartmentId));
  if (basicsForm instanceof HTMLFormElement) {
    filled.push(...applyListingPreviewFields(basicsForm, fields, options));
  }

  const titleRoot = document.getElementById(apartmentTitleFormId(apartmentId));
  if (titleRoot) {
    const onlyEmpty = options?.onlyEmpty !== false;
    if (setNamedField(titleRoot, "title", fields.title, onlyEmpty)) {
      filled.push("title");
    }
  }

  const descRoot = document.getElementById(apartmentDescriptionFormId(apartmentId));
  if (descRoot) {
    const onlyEmpty = options?.onlyEmpty !== false;
    if (setNamedField(descRoot, "description", fields.description, onlyEmpty)) {
      filled.push("description");
    }
  }

  const brokerRoot = document.getElementById(apartmentBrokerFormId(apartmentId));
  if (brokerRoot) {
    const onlyEmpty = options?.onlyEmpty !== false;
    if (setBrokerCheckbox(brokerRoot, fields.brokerInvolved, onlyEmpty)) {
      filled.push("brokerInvolved");
    }
  }

  const unique = [...new Set(filled)];
  const highlightKeys = options?.highlightKeys ?? unique;
  if (highlightKeys.length > 0) {
    const page = document.getElementById(`apartment-page-${apartmentId}`);
    if (page) {
      highlightPrefilledFields(page, highlightKeys, {
        clear: options?.clearHighlights !== false,
      });
    }
  }

  return unique;
}

/** Apply a single preview field (e.g. KI suggestion accept) without touching other inputs. */
export function applyListingPreviewFieldKey(
  apartmentId: string,
  key: ListingPreviewFieldKey,
  fields: ListingPreviewFields,
  options?: { highlight?: boolean }
): boolean {
  const slice: ListingPreviewFields = { [key]: fields[key] } as ListingPreviewFields;
  const filled = applyListingPreviewToApartment(apartmentId, slice, {
    onlyEmpty: false,
    highlightKeys: options?.highlight !== false ? [key] : [],
    clearHighlights: false,
  });
  return filled.includes(key);
}
