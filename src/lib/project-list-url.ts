import {
  DEFAULT_APARTMENT_SORT,
  DEFAULT_APARTMENT_SORT_ORDER,
  type ApartmentSortKey,
  type ApartmentSortOrder,
} from "@/lib/scoring";

export function projectListHref(
  projectId: string,
  tab: string,
  sort: ApartmentSortKey,
  order: ApartmentSortOrder,
  searchQuery?: string
): string {
  const params = new URLSearchParams();
  if (tab === "archived") params.set("tab", "archived");
  if (sort !== DEFAULT_APARTMENT_SORT) params.set("sort", sort);
  if (order !== DEFAULT_APARTMENT_SORT_ORDER) params.set("order", order);
  const q = searchQuery?.trim();
  if (q) params.set("q", q);
  const query = params.toString();
  return `/project/${projectId}${query ? `?${query}` : ""}`;
}
