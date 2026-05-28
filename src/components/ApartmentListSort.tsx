"use client";

import { useRouter } from "next/navigation";
import { projectListHref } from "@/lib/project-list-url";
import type { ApartmentSortKey, ApartmentSortOrder } from "@/lib/scoring";

const SORT_OPTIONS: { key: ApartmentSortKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "price", label: "Preis" },
  { key: "ppp", label: "€/Punkt" },
  { key: "date", label: "Datum" },
  { key: "appointment", label: "Termin" },
];

export function ApartmentListSort({
  projectId,
  tab,
  current,
  currentOrder,
  searchQuery,
}: {
  projectId: string;
  tab: string;
  current: ApartmentSortKey;
  currentOrder: ApartmentSortOrder;
  searchQuery?: string;
}) {
  const router = useRouter();

  function navigate(sort: ApartmentSortKey, order: ApartmentSortOrder) {
    router.push(projectListHref(projectId, tab, sort, order, searchQuery));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <label className="block">
        <span className="text-sm text-pn-text-secondary">Sortierung</span>
        <select
          value={current}
          onChange={(e) => navigate(e.target.value as ApartmentSortKey, currentOrder)}
          className="mt-1 block border border-pn-border rounded-lg px-3 py-2 text-sm bg-white min-w-[140px]"
        >
          {SORT_OPTIONS.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm text-pn-text-secondary">Reihenfolge</span>
        <select
          value={currentOrder}
          onChange={(e) => navigate(current, e.target.value as ApartmentSortOrder)}
          className="mt-1 block border border-pn-border rounded-lg px-3 py-2 text-sm bg-white min-w-[140px]"
        >
          <option value="desc">Absteigend</option>
          <option value="asc">Aufsteigend</option>
        </select>
      </label>
    </div>
  );
}
