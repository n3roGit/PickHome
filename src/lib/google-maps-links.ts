/** Opens Google Maps Street View at coordinates (no API key; browser link only). */
export function buildGoogleMapsStreetViewUrl(options: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}): string | null {
  const lat = options.latitude;
  const lng = options.longitude;
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    const params = new URLSearchParams({
      api: "1",
      map_action: "pano",
      viewpoint: `${lat},${lng}`,
    });
    return `https://www.google.com/maps/@?${params.toString()}`;
  }

  const address = options.address?.trim();
  if (!address) return null;

  const params = new URLSearchParams({ api: "1", query: address });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function hasGoogleMapsStreetViewCoords(
  latitude?: number | null,
  longitude?: number | null
): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}
