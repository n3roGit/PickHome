import { prisma } from "@/lib/prisma";
import {
  markersForMap,
  POI_CATEGORY_LABELS,
  type OverpassPoiData,
  type PoiCategoryId,
} from "@/lib/overpass-poi";

export type ProjectMapPoi = {
  lat: number;
  lng: number;
  categoryId: PoiCategoryId;
  name: string | null;
  distanceM: number;
  apartmentId: string;
  apartmentTitle: string;
};

const MAX_POIS_PER_APARTMENT = 120;

export async function getProjectMapPoisForApartments(
  apartments: { id: string; title: string }[]
): Promise<ProjectMapPoi[]> {
  if (apartments.length === 0) return [];

  const caches = await prisma.apartmentLocationInsightCache.findMany({
    where: {
      apartmentId: { in: apartments.map((a) => a.id) },
      domain: "overpass",
      status: "ok",
      payloadJson: { not: null },
    },
    select: { apartmentId: true, payloadJson: true },
  });

  const titleById = new Map(apartments.map((a) => [a.id, a.title]));
  const out: ProjectMapPoi[] = [];

  for (const row of caches) {
    const title = titleById.get(row.apartmentId) ?? "Immobilie";
    const data = JSON.parse(row.payloadJson!) as OverpassPoiData;
    const markers = markersForMap(data).slice(0, MAX_POIS_PER_APARTMENT);
    for (const m of markers) {
      out.push({
        lat: m.lat,
        lng: m.lng,
        categoryId: m.categoryId,
        name: m.name,
        distanceM: m.distanceM,
        apartmentId: row.apartmentId,
        apartmentTitle: title,
      });
    }
  }

  return out;
}

export function projectMapPoiPopupHtml(poi: ProjectMapPoi): string {
  const name = poi.name ?? "Unbenannt";
  const category = POI_CATEGORY_LABELS[poi.categoryId];
  const apt = escapeHtml(poi.apartmentTitle);
  const label = escapeHtml(category);
  const title = escapeHtml(name);
  return `<div class="text-sm leading-snug">
    <p class="font-semibold m-0">${title}</p>
    <p class="text-xs mt-1 m-0 opacity-80">${label} · ${poi.distanceM} m</p>
    <p class="text-xs mt-1 m-0 opacity-70">Bei: ${apt}</p>
  </div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
