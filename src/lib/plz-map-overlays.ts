import { extractGermanPlz } from "@/lib/federal-state-from-address";
import { geocodeAddress } from "@/lib/geocode";
import { plzCentroid } from "@/lib/plz-reference";

export const DEFAULT_PLZ_OVERLAY_RADIUS_M = 2200;
/** Merge circles when center distance is below this factor × radius (strong overlap). */
export const PLZ_OVERLAY_MERGE_WITHIN_FACTOR = 1.35;

export type PlzMapOverlay = {
  plz: string;
  lat: number;
  lng: number;
  radiusM?: number;
  plzList?: string[];
};

type ApartmentCoords = {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

function averageApartmentCentroids(
  selectedPlz: string[],
  apartments: ApartmentCoords[]
): Map<string, { lat: number; lng: number }> {
  const sums = new Map<string, { lat: number; lng: number; count: number }>();

  for (const apartment of apartments) {
    if (apartment.latitude == null || apartment.longitude == null || !apartment.address?.trim()) {
      continue;
    }
    const plz = extractGermanPlz(apartment.address);
    if (!plz || !selectedPlz.includes(plz)) continue;

    const current = sums.get(plz) ?? { lat: 0, lng: 0, count: 0 };
    sums.set(plz, {
      lat: current.lat + apartment.latitude,
      lng: current.lng + apartment.longitude,
      count: current.count + 1,
    });
  }

  const result = new Map<string, { lat: number; lng: number }>();
  for (const [plz, sum] of sums) {
    if (sum.count > 0) {
      result.set(plz, { lat: sum.lat / sum.count, lng: sum.lng / sum.count });
    }
  }
  return result;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadiusM = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(a));
}

export function mergeOverlappingPlzOverlays(
  overlays: PlzMapOverlay[],
  radiusM = DEFAULT_PLZ_OVERLAY_RADIUS_M,
  mergeWithinFactor = PLZ_OVERLAY_MERGE_WITHIN_FACTOR
): PlzMapOverlay[] {
  if (overlays.length <= 1) {
    return overlays.map((overlay) => ({ ...overlay, radiusM: overlay.radiusM ?? radiusM }));
  }

  const parent = overlays.map((_, index) => index);

  function find(index: number): number {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  }

  function unite(a: number, b: number) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootA] = rootB;
  }

  const mergeDistanceM = mergeWithinFactor * radiusM;
  for (let i = 0; i < overlays.length; i++) {
    for (let j = i + 1; j < overlays.length; j++) {
      const distance = haversineMeters(
        overlays[i].lat,
        overlays[i].lng,
        overlays[j].lat,
        overlays[j].lng
      );
      if (distance < mergeDistanceM) unite(i, j);
    }
  }

  const groups = new Map<number, PlzMapOverlay[]>();
  for (let i = 0; i < overlays.length; i++) {
    const root = find(i);
    const group = groups.get(root) ?? [];
    group.push(overlays[i]);
    groups.set(root, group);
  }

  return [...groups.values()].map((members) => {
    if (members.length === 1) {
      return { ...members[0], radiusM: members[0].radiusM ?? radiusM };
    }

    const lat = members.reduce((sum, member) => sum + member.lat, 0) / members.length;
    const lng = members.reduce((sum, member) => sum + member.lng, 0) / members.length;
    const plzList = members.map((member) => member.plz).sort((a, b) => a.localeCompare(b));
    let mergedRadius = radiusM;
    for (const member of members) {
      const dist = haversineMeters(lat, lng, member.lat, member.lng);
      mergedRadius = Math.max(mergedRadius, dist + radiusM);
    }

    return {
      plz: plzList.join(", "),
      plzList,
      lat,
      lng,
      radiusM: mergedRadius,
    };
  });
}

export async function resolvePlzMapOverlays(
  selectedPlz: string[],
  apartments: ApartmentCoords[]
): Promise<PlzMapOverlay[]> {
  if (selectedPlz.length === 0) return [];

  const fromApartments = averageApartmentCentroids(selectedPlz, apartments);
  const overlays: PlzMapOverlay[] = [];
  const needsGeocode: string[] = [];

  for (const plz of selectedPlz) {
    const fromApt = fromApartments.get(plz);
    if (fromApt) {
      overlays.push({ plz, lat: fromApt.lat, lng: fromApt.lng });
      continue;
    }
    const staticCentroid = plzCentroid(plz);
    if (staticCentroid) {
      overlays.push({ plz, lat: staticCentroid.lat, lng: staticCentroid.lng });
      continue;
    }
    needsGeocode.push(plz);
  }

  for (const plz of needsGeocode) {
    const coords = await geocodeAddress(`${plz}, Deutschland`);
    if (coords) {
      overlays.push({ plz, lat: coords.latitude, lng: coords.longitude });
    }
    if (needsGeocode.length > 1) {
      await sleep(1100);
    }
  }

  return mergeOverlappingPlzOverlays(
    overlays.sort((a, b) => a.plz.localeCompare(b.plz))
  );
}
