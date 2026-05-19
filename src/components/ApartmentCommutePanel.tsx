import {
  computeCommuteLegs,
  type CommuteLeg,
} from "@/lib/commute";
import { travelModeLabel, type TravelMode } from "@/lib/travel-mode";

const UNAVAILABLE_MESSAGES: Record<NonNullable<CommuteLeg["unavailableReason"]>, string> = {
  missing_apartment_coords: "Immobilie hat keine Koordinaten (Adresse fehlt oder nicht geocodiert).",
  missing_address_coords: "Adresse konnte nicht geocodiert werden — bitte in den Einstellungen prüfen.",
  routing_failed: "Route konnte nicht berechnet werden.",
};

export function commuteUnavailableMessage(reason: CommuteLeg["unavailableReason"]): string | null {
  if (!reason) return null;
  return UNAVAILABLE_MESSAGES[reason];
}

export function ApartmentCommutePanel({
  legs,
  travelMode,
  settingsHref,
}: {
  legs: CommuteLeg[];
  travelMode: TravelMode;
  settingsHref: string;
}) {
  if (legs.length === 0) {
    return (
      <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6">
        <h2 className="font-semibold mb-1">Anfahrt</h2>
        <p className="text-sm text-pn-text-tertiary">
          Keine Adressen hinterlegt. In den{" "}
          <a href={settingsHref} className="text-pn-accent hover:underline">
            Kontoeinstellungen
          </a>{" "}
          z. B. Arbeit oder andere Ziele anlegen.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6">
      <h2 className="font-semibold mb-1">Anfahrt</h2>
      <p className="text-sm text-pn-text-secondary mb-4">
        Schätzung per OpenStreetMap-Routing ({travelModeLabel(travelMode)}).
      </p>
      <ul className="space-y-3">
        {legs.map((leg) => (
          <li key={leg.addressId} className="border border-pn-border rounded-lg px-4 py-3">
            <p className="font-medium">{leg.label}</p>
            <p className="text-sm text-pn-text-secondary">{leg.address}</p>
            {leg.distanceText && leg.durationText ? (
              <p className="text-sm mt-2">
                <span className="font-medium">{leg.distanceText}</span>
                <span className="text-pn-text-tertiary"> · ca. {leg.durationText}</span>
              </p>
            ) : (
              <p className="text-sm text-pn-text-tertiary mt-2">
                {commuteUnavailableMessage(leg.unavailableReason)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
