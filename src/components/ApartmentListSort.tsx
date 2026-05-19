import Link from "next/link";
import type { ApartmentSortKey } from "@/lib/scoring";

const SORT_OPTIONS: { key: ApartmentSortKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "price", label: "Preis" },
  { key: "ppp", label: "€/Punkt" },
  { key: "date", label: "Neueste" },
];

export function projectListHref(
  projectId: string,
  tab: string,
  sort: ApartmentSortKey,
  searchQuery?: string
): string {
  const params = new URLSearchParams();
  if (tab === "archived") params.set("tab", "archived");
  if (sort !== "score") params.set("sort", sort);
  const q = searchQuery?.trim();
  if (q) params.set("q", q);
  const query = params.toString();
  return `/project/${projectId}${query ? `?${query}` : ""}`;
}

export function ApartmentListSort({
  projectId,
  tab,
  current,
  searchQuery,
}: {
  projectId: string;
  tab: string;
  current: ApartmentSortKey;
  searchQuery?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-sm text-pn-text-secondary">Sortierung:</span>
      {SORT_OPTIONS.map(({ key, label }) => (
        <Link
          key={key}
          href={projectListHref(projectId, tab, key, searchQuery)}
          className={`text-sm px-3 py-1 rounded-lg border ${
            current === key
              ? "border-pn-accent bg-pn-accent/10 text-pn-accent font-medium"
              : "border-pn-border text-pn-text-secondary hover:border-pn-accent/50"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
