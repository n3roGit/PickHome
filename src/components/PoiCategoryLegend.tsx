"use client";

import {
  POI_CATEGORY_COLORS,
  POI_CATEGORY_LABELS,
  POI_CATEGORY_ORDER,
  type PoiCategoryId,
} from "@/lib/overpass-poi";

export function PoiCategoryLegend({
  counts,
  hiddenCategories,
  onToggleCategory,
  footer,
}: {
  counts: Record<PoiCategoryId, number>;
  hiddenCategories: Set<PoiCategoryId>;
  onToggleCategory: (id: PoiCategoryId) => void;
  footer?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {POI_CATEGORY_ORDER.map((id) => {
          const count = counts[id];
          if (count === 0) return null;
          const hidden = hiddenCategories.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggleCategory(id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                hidden
                  ? "border-pn-border bg-pn-bg-subtle text-pn-text-tertiary line-through opacity-60"
                  : "border-pn-border bg-pn-bg-subtle text-pn-text-secondary hover:border-pn-accent"
              }`}
              title={hidden ? "Einblenden" : "Ausblenden"}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: POI_CATEGORY_COLORS[id] }}
              />
              {POI_CATEGORY_LABELS[id]} ({count})
            </button>
          );
        })}
      </div>
      {footer ? <p className="text-xs text-pn-text-tertiary">{footer}</p> : null}
    </div>
  );
}
