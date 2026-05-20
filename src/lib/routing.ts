import { fetchExternal } from "@/lib/external-fetch";
import type { TravelMode } from "@/lib/travel-mode";

/** Modes routed via OSRM (excludes ÖPNV). */
export type OsrmTravelMode = Exclude<TravelMode, "transit">;

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
};

/** OSRM profile segment for a travel mode (depends on server build). */
export function osrmProfileForMode(mode: OsrmTravelMode): string {
  return osrmEndpointForMode(mode).profile;
}

export type OsrmEndpoint = {
  baseUrl: string;
  profile: string;
};

/**
 * Default routing uses FOSSGIS (openstreetmap.de) with separate graphs per mode.
 * The public project-osrm.org demo only supports driving and returns car routes for every profile.
 * Self-hosted OSRM: set OSRM_BASE_URL; optional OSRM_PROFILE_FOOT / _BIKE / _DRIVING overrides.
 */
export function osrmEndpointForMode(mode: OsrmTravelMode): OsrmEndpoint {
  const custom = process.env.OSRM_BASE_URL?.replace(/\/$/, "");
  if (custom) {
    const profileByMode: Record<OsrmTravelMode, string> = {
      foot: process.env.OSRM_PROFILE_FOOT ?? "foot",
      bike: process.env.OSRM_PROFILE_BIKE ?? "bike",
      driving: process.env.OSRM_PROFILE_DRIVING ?? "driving",
    };
    return { baseUrl: custom, profile: profileByMode[mode] };
  }

  switch (mode) {
    case "foot":
      return { baseUrl: "https://routing.openstreetmap.de/routed-foot", profile: "foot" };
    case "bike":
      return { baseUrl: "https://routing.openstreetmap.de/routed-bike", profile: "bike" };
    case "driving":
      return { baseUrl: "https://routing.openstreetmap.de/routed-car", profile: "car" };
  }
}

export function formatRouteDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = Math.round((meters / 1000) * 10) / 10;
  return `${String(km).replace(".", ",")} km`;
}

export function formatRouteDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} Min.`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} Std.`;
  return `${hours} Std. ${minutes} Min.`;
}

export function osrmBaseUrl(): string {
  return osrmEndpointForMode("driving").baseUrl;
}

export async function fetchRoute(
  from: RoutePoint,
  to: RoutePoint,
  mode: OsrmTravelMode
): Promise<RouteResult | null> {
  const { baseUrl, profile } = osrmEndpointForMode(mode);
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `${baseUrl}/route/v1/${profile}/${coords}?overview=false`;

  const res = await fetchExternal("osrm", url, {
    headers: { "User-Agent": "PickHome/1.0 (self-hosted)" },
    next: { revalidate: 3600 },
  });
  if (!res?.ok) return null;

  try {
    const data = (await res.json()) as {
      routes?: { distance?: number; duration?: number }[];
    };
    const route = data.routes?.[0];
    if (route?.distance == null || route.duration == null) return null;

    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch {
    return null;
  }
}
