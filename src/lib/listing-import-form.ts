import type { ListingPreviewFields } from "@/lib/listing-import";

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

export function apartmentBrokerFormId(apartmentId: string) {
  return `apartment-broker-${apartmentId}`;
}

function setNamedField(
  root: ParentNode,
  name: string,
  value: string | number | undefined,
  onlyEmpty: boolean
) {
  if (value == null || value === "") return;
  const el = root.querySelector(`[name="${name}"]`) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;
  if (!el) return;
  if (onlyEmpty && el.value.trim() !== "") return;
  el.value = String(value);
}

function setBrokerCheckbox(
  root: ParentNode,
  value: boolean | undefined,
  onlyEmpty: boolean
) {
  if (value == null) return;
  const el = root.querySelector('[name="brokerInvolved"]') as HTMLInputElement | null;
  if (!el || el.type !== "checkbox") return;
  if (onlyEmpty && el.checked) return;
  el.checked = value;
}

export function applyListingPreviewFields(
  form: HTMLFormElement,
  fields: ListingPreviewFields,
  options?: { onlyEmpty?: boolean }
) {
  const onlyEmpty = options?.onlyEmpty !== false;
  setNamedField(form, "title", fields.title, onlyEmpty);
  setNamedField(form, "price", fields.price, onlyEmpty);
  setNamedField(form, "address", fields.address, onlyEmpty);
  setNamedField(form, "sizeSqm", fields.sizeSqm, onlyEmpty);
  setNamedField(form, "energyClass", fields.energyClass, onlyEmpty);
  setNamedField(form, "description", fields.description, onlyEmpty);
  setBrokerCheckbox(form, fields.brokerInvolved, onlyEmpty);
}

/** Fill basics, title, and description blocks on the apartment detail page. */
export function applyListingPreviewToApartment(
  apartmentId: string,
  fields: ListingPreviewFields,
  options?: { onlyEmpty?: boolean }
) {
  const onlyEmpty = options?.onlyEmpty !== false;
  const basicsForm = document.getElementById(apartmentBasicsFormId(apartmentId));
  if (basicsForm instanceof HTMLFormElement) {
    applyListingPreviewFields(basicsForm, fields, options);
  }
  const titleRoot = document.getElementById(apartmentTitleFormId(apartmentId));
  if (titleRoot) setNamedField(titleRoot, "title", fields.title, onlyEmpty);
  const descRoot = document.getElementById(apartmentDescriptionFormId(apartmentId));
  if (descRoot) setNamedField(descRoot, "description", fields.description, onlyEmpty);
  const brokerRoot = document.getElementById(apartmentBrokerFormId(apartmentId));
  if (brokerRoot) setBrokerCheckbox(brokerRoot, fields.brokerInvolved, onlyEmpty);
}
