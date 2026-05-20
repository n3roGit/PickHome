import { CollapsibleSection } from "@/components/CollapsibleSection";
import { CommuteTransitConnection } from "@/components/CommuteTransitConnection";
import {
  COMMUTE_PENDING_NOTE,
  commuteUnavailableMessage,
  type CommuteLeg,
  type CommutePersonEstimate,
} from "@/lib/commute";
import { companyCarCommuteMethodLabel, formatCommuteBenefitEur } from "@/lib/company-car";
import { travelModeLabel } from "@/lib/travel-mode";

function CommuteLegList({
  legs,
  travelMode,
}: {
  legs: CommuteLeg[];
  travelMode: CommutePersonEstimate["travelMode"];
}) {
  return (
    <ul className="space-y-3">
      {legs.map((leg) => (
        <li key={leg.addressId} className="border border-pn-border rounded-lg px-4 py-3">
          <p className="font-medium">
            {leg.label}
            {leg.monthlyCompanyCarTotalBenefitEur != null && (
              <span className="ml-2 text-xs font-normal text-pn-text-tertiary">(Arbeitsstätte)</span>
            )}
          </p>
          <p className="text-sm text-pn-text-secondary">{leg.address}</p>
          {leg.durationText ? (
            <>
              <p className="text-sm mt-2">
                {leg.distanceText && (
                  <>
                    <span className="font-medium">{leg.distanceText}</span>
                    <span className="text-pn-text-tertiary"> · </span>
                  </>
                )}
                <span className={leg.distanceText ? "text-pn-text-tertiary" : "font-medium"}>
                  ca. {leg.durationText}
                </span>
              </p>
              {leg.connectionSummary ? (
                <CommuteTransitConnection
                  summary={leg.connectionSummary}
                  detailLines={
                    leg.transitDetailTooltip
                      ? leg.transitDetailTooltip.split("\n").filter(Boolean)
                      : []
                  }
                />
              ) : null}
              {leg.routingNote && (
                <p className="text-xs text-pn-text-tertiary mt-1">{leg.routingNote}</p>
              )}
              {leg.monthlyCompanyCarTotalBenefitEur != null && leg.distanceKmOneWay != null && (
                <p className="text-sm mt-2 text-pn-text-secondary">
                  Firmenwagen: Brutto ca.{" "}
                  <span className="font-medium text-pn-text-primary">
                    {formatCommuteBenefitEur(leg.monthlyCompanyCarTotalBenefitEur)}
                  </span>
                  /Monat
                  {leg.monthlyCompanyCarTotalNetBenefitEur != null &&
                    leg.companyCarMarginalTaxRatePercent != null && (
                      <>
                        {" · "}
                        Netto ca.{" "}
                        <span className="font-medium text-pn-text-primary">
                          {formatCommuteBenefitEur(leg.monthlyCompanyCarTotalNetBenefitEur)}
                        </span>
                        /Monat
                        <span className="text-pn-text-tertiary">
                          {" "}
                          ({leg.companyCarMarginalTaxRatePercent} % Grenzsteuersatz)
                        </span>
                      </>
                    )}
                  {leg.monthlyCompanyCarBaseBenefitEur != null &&
                    leg.monthlyCompanyCarCommuteBenefitEur != null && (
                      <span className="block text-xs text-pn-text-tertiary mt-1">
                        Brutto: Grundanteil {formatCommuteBenefitEur(leg.monthlyCompanyCarBaseBenefitEur)} ·
                        Arbeitsweg
                        {leg.companyCarCommuteMethod === "trips" &&
                        leg.companyCarOfficeTripsPerMonth != null
                          ? ` (${leg.distanceKmOneWay} km × ${leg.companyCarOfficeTripsPerMonth} Fahrten)`
                          : ` (${leg.distanceKmOneWay} km einfach)`}{" "}
                        {formatCommuteBenefitEur(leg.monthlyCompanyCarCommuteBenefitEur)}
                        {leg.companyCarCommuteMethod && (
                          <> · {companyCarCommuteMethodLabel(leg.companyCarCommuteMethod)}</>
                        )}
                        {leg.monthlyCompanyCarDeductionsEur != null &&
                          leg.monthlyCompanyCarDeductionsEur > 0 && (
                            <>
                              {" · "}
                              Abzüge {formatCommuteBenefitEur(leg.monthlyCompanyCarDeductionsEur)}
                            </>
                          )}
                        {leg.companyCarEmployerFuelCard && (
                          <> · Tank-/Ladekarte Arbeitgeber (in 1‑%-Regelung enthalten)</>
                        )}
                      </span>
                    )}
                </p>
              )}
              {leg.commuteCostHint && (
                <p className="text-xs text-pn-text-tertiary mt-1">{leg.commuteCostHint}</p>
              )}
            </>
          ) : leg.routingNote ? (
            <div className="text-sm mt-2">
              {leg.distanceText && (
                <p>
                  <span className="font-medium">{leg.distanceText}</span>
                  <span className="text-pn-text-tertiary"> (Auto)</span>
                </p>
              )}
              <p className="text-pn-text-tertiary mt-1">({leg.routingNote})</p>
            </div>
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
              <CommuteLegList legs={person.legs} travelMode={person.travelMode} />
            )}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
