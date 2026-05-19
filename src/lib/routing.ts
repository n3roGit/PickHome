import type { TravelMode } from "@/lib/travel-mode";

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
};

export function osrmProfileForMode(mode: TravelMode): string {
  return mode;
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
  return (process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org").replace(/\/$/, "");
}

export async function fetchRoute(
  from: RoutePoint,
  to: RoutePoint,
  mode: TravelMode
): Promise<RouteResult | null> {
  const profile = osrmProfileForMode(mode);
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `${osrmBaseUrl()}/route/v1/${profile}/${coords}?overview=false`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PickHome/1.0 (self-hosted)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

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
