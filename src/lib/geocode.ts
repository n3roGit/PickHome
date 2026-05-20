import { fetchExternal } from "@/lib/external-fetch";

/** Nominatim (OpenStreetMap) — use sparingly; respect usage policy (max 1 req/s). */
export async function geocodeAddress(
  address: string
): Promise<{ latitude: number; longitude: number } | null> {
  const q = address.trim();
  if (!q) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetchExternal("nominatim", url.toString(), {
    headers: { "User-Agent": "PickHome/1.0 (local self-hosted)" },
    next: { revalidate: 86400 },
  });
  if (!res?.ok) return null;

  const data = (await res.json()) as { lat: string; lon: string }[];
  if (!data[0]) return null;

  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
  };
}
