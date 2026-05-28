import {
  getCachedLocationInsight,
  getOrFetchLocationInsight,
  isLocationInsightCacheFresh,
  type LocationInsightSnapshot,
} from "@/lib/location-insight-cache";
import { prisma } from "@/lib/prisma";
import {
  fetchOverpassPois,
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

export function projectMapPoisFromOverpassData(
  apartmentId: string,
  apartmentTitle: string,
  data: OverpassPoiData
): ProjectMapPoi[] {
  const markers = markersForMap(data).slice(0, MAX_POIS_PER_APARTMENT);
  return markers.map((m) => ({
    lat: m.lat,
    lng: m.lng,
    categoryId: m.categoryId,
    name: m.name,
    distanceM: m.distanceM,
    apartmentId,
    apartmentTitle,
  }));
}

function overpassSnapshotHasMarkers(snapshot: LocationInsightSnapshot<OverpassPoiData>): boolean {
  if (snapshot.status !== "ok" || !snapshot.data) return false;
  return markersForMap(snapshot.data).length > 0;
}

async function loadOverpassSnapshotForMap(
  apartmentId: string
): Promise<LocationInsightSnapshot<OverpassPoiData>> {
  const cached = await getCachedLocationInsight<OverpassPoiData>(prisma, apartmentId, "overpass");
  if (cached && overpassSnapshotHasMarkers(cached)) {
    return cached;
  }
  if (
    cached &&
    isLocationInsightCacheFresh(cached.fetchedAt) &&
    cached.status !== "pending"
  ) {
    return cached;
  }
  return getOrFetchLocationInsight(prisma, apartmentId, "overpass", fetchOverpassPois);
}

export async function getProjectMapPoisForApartments(
  apartments: { id: string; title: string }[]
): Promise<ProjectMapPoi[]> {
  if (apartments.length === 0) return [];

  const titleById = new Map(apartments.map((a) => [a.id, a.title]));
  const out: ProjectMapPoi[] = [];

  for (const apt of apartments) {
    const snapshot = await loadOverpassSnapshotForMap(apt.id);
    if (snapshot.status !== "ok" || !snapshot.data) continue;
    const title = titleById.get(apt.id) ?? "Immobilie";
    out.push(...projectMapPoisFromOverpassData(apt.id, title, snapshot.data));
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
