import type { ListingPreviewFields } from "@/lib/listing-import";

export function apartmentBasicsFormId(apartmentId: string) {
  return `apartment-basics-${apartmentId}`;
}

export function applyListingPreviewFields(
  form: HTMLFormElement,
  fields: ListingPreviewFields,
  options?: { onlyEmpty?: boolean }
) {
  const onlyEmpty = options?.onlyEmpty !== false;

  const set = (name: string, value: string | number | undefined) => {
    if (value == null || value === "") return;
    const el = form.elements.namedItem(name) as HTMLInputElement | null;
    if (!el) return;
    if (onlyEmpty && el.value.trim() !== "") return;
    el.value = String(value);
  };

  set("title", fields.title);
  set("price", fields.price);
  set("address", fields.address);
  set("sizeSqm", fields.sizeSqm);
  set("energyClass", fields.energyClass);
}
