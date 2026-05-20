import { CollapsibleSection } from "@/components/CollapsibleSection";
import {
  commuteUnavailableMessage,
  type CommuteLeg,
  type CommutePersonEstimate,
} from "@/lib/commute";
import { travelModeLabel } from "@/lib/travel-mode";

function CommuteLegList({ legs }: { legs: CommuteLeg[] }) {
  return (
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
  );
}

export function ApartmentCommutePanel({
  people,
  settingsHref,
}: {
  people: CommutePersonEstimate[];
  settingsHref: string;
}) {
  if (people.length === 1 && people[0].legs.length === 0) {
    return (
      <CollapsibleSection title="Anfahrt">
        <p className="text-sm text-pn-text-tertiary">
          Noch keine Anfahrtszeiten — in den{" "}
          <a href={settingsHref} className="text-pn-accent hover:underline">
            Kontoeinstellungen
          </a>{" "}
          z. B. Arbeit oder andere Ziele anlegen.
        </p>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="Anfahrt"
      subtitle="Geschätzte Anfahrt pro Person — Verkehrsmittel und Ziele aus den jeweiligen Kontoeinstellungen."
    >
      <div className="space-y-6">
        {people.map((person) => (
          <div key={person.userId}>
            <h3 className="text-sm font-semibold mb-0.5">
              {person.isCurrentUser ? "Du" : person.name}
            </h3>
            <p className="text-xs text-pn-text-tertiary mb-3">
              {travelModeLabel(person.travelMode)}
            </p>
            {person.legs.length === 0 ? (
              <p className="text-sm text-pn-text-tertiary">
                {person.isCurrentUser ? (
                  <>
                    Keine Adressen hinterlegt — in den{" "}
                    <a href={settingsHref} className="text-pn-accent hover:underline">
                      Kontoeinstellungen
                    </a>{" "}
                    anlegen.
                  </>
                ) : (
                  <>Keine Adressen hinterlegt.</>
                )}
              </p>
            ) : (
              <CommuteLegList legs={person.legs} />
            )}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
