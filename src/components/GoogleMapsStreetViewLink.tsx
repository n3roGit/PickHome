import {
  buildGoogleMapsStreetViewUrl,
  hasGoogleMapsStreetViewCoords,
} from "@/lib/google-maps-links";

export function GoogleMapsStreetViewLink({
  latitude,
  longitude,
  address,
  className = "text-xs text-pn-accent hover:underline inline-block",
}: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  className?: string;
}) {
  const href = buildGoogleMapsStreetViewUrl({ latitude, longitude, address });
  if (!href) return null;

  const streetView = hasGoogleMapsStreetViewCoords(latitude, longitude);
  const label = streetView ? "Street View öffnen" : "In Google Maps öffnen";

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label} ↗
    </a>
  );
}
