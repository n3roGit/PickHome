import Link from "next/link";
import type { ApartmentSortKey, ApartmentSortOrder } from "@/lib/scoring";
import { projectListHref } from "@/lib/project-list-url";
import {
  DEFAULT_APARTMENT_SORT,
  DEFAULT_APARTMENT_SORT_ORDER,
} from "@/lib/scoring";

export function ApartmentProjectSearch({
  projectId,
  tab,
  sort,
  order,
  query,
  resultCount,
  totalCount,
}: {
  projectId: string;
  tab: string;
  sort: ApartmentSortKey;
  order: ApartmentSortOrder;
  query: string;
  resultCount: number;
  totalCount: number;
}) {
  const trimmed = query.trim();
  const listHref = projectListHref(projectId, tab, sort, order);

  return (
    <div className="mb-4">
      <form method="get" action={`/project/${projectId}`} className="flex flex-wrap gap-2 items-center">
        {tab === "archived" && <input type="hidden" name="tab" value="archived" />}
        {sort !== DEFAULT_APARTMENT_SORT && <input type="hidden" name="sort" value={sort} />}
        {order !== DEFAULT_APARTMENT_SORT_ORDER && <input type="hidden" name="order" value={order} />}
        <label className="sr-only" htmlFor="apartment-search">
          Immobilien durchsuchen
        </label>
        <input
          id="apartment-search"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Volltext: Notizen, Baujahr, Adresse, Kriterien …"
          className="border border-pn-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[220px]"
        />
        <button
          type="submit"
          className="bg-pn-accent text-white font-medium px-4 py-2 rounded-lg text-sm"
        >
          Suchen
        </button>
        {trimmed && (
          <Link
            href={listHref}
            className="text-sm text-pn-text-secondary hover:text-pn-accent px-2 py-2"
          >
            Zurücksetzen
          </Link>
        )}
      </form>
      {trimmed && (
        <p className="text-sm text-pn-text-secondary mt-2">
          {resultCount} von {totalCount} Immobilien
          {resultCount === 0 && (
            <span className="text-pn-text-tertiary"> — kein Treffer für „{trimmed}"</span>
          )}
        </p>
      )}
    </div>
  );
}
