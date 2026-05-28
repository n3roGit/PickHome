/** Approximate WGS84 → Web Mercator (EPSG:3857) for ArcGIS services that use 102100. */
export function wgs84ToWebMercator(latitude: number, longitude: number): { x: number; y: number } {
  const x = (longitude * 20037508.34) / 180;
  const y =
    Math.log(Math.tan(((90 + latitude) * Math.PI) / 360)) / (Math.PI / 180);
  const yMerc = (y * 20037508.34) / 180;
  return { x, y: yMerc };
}

/** Haversine distance in meters between two WGS84 points. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
