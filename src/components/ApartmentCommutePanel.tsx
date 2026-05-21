import { CollapsibleSection } from "@/components/CollapsibleSection";
import { CommuteTransitConnection } from "@/components/CommuteTransitConnection";
import {
  COMMUTE_PENDING_NOTE,
  commuteUnavailableMessage,
  type CommuteLeg,
  type CommutePersonEstimate,
} from "@/lib/commute";
import { companyCarCommuteMethodLabel, formatCommuteBenefitEur } from "@/lib/company-car";
import { commuteDaysSourceLabel } from "@/lib/commuter-allowance";
import { travelModeLabel } from "@/lib/travel-mode";

function CommuteCompanyCarBenefit({ leg }: { leg: CommuteLeg }) {
  if (leg.monthlyCompanyCarTotalBenefitEur == null || leg.distanceKmOneWay == null) {
    return null;
  }

  return (
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
      {leg.monthlyCompanyCarBaseBenefitEur != null && leg.monthlyCompanyCarCommuteBenefitEur != null && (
        <span className="block text-xs text-pn-text-tertiary mt-1">
          Brutto: Grundanteil {formatCommuteBenefitEur(leg.monthlyCompanyCarBaseBenefitEur)} · Arbeitsweg
          {leg.companyCarCommuteMethod === "trips" && leg.companyCarOfficeTripsPerMonth != null
            ? ` (${leg.distanceKmOneWay} km × ${leg.companyCarOfficeTripsPerMonth} Fahrten)`
            : ` (${leg.distanceKmOneWay} km einfach)`}{" "}
          {formatCommuteBenefitEur(leg.monthlyCompanyCarCommuteBenefitEur)}
          {leg.companyCarCommuteMethod && (
            <> · {companyCarCommuteMethodLabel(leg.companyCarCommuteMethod)}</>
          )}
          {leg.monthlyCompanyCarDeductionsEur != null && leg.monthlyCompanyCarDeductionsEur > 0 && (
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
      {leg.annualCommuterAllowanceEur != null && (
        <span className="block text-xs text-pn-text-tertiary mt-1">
          Pendlerpauschale (geschätzt, Steuererklärung): ca.{" "}
          {formatCommuteBenefitEur(leg.annualCommuterAllowanceEur)}/Jahr
          {leg.commuterAllowanceDaysPerYear != null && (
            <>
              {" "}
              bei {leg.commuterAllowanceDaysPerYear} Pendeltagen
              {leg.commuterAllowanceKmOneWay != null && (
                <> ({leg.commuterAllowanceKmOneWay} km einfach, abgerundet)</>
              )}
            </>
          )}
          {leg.annualCommuterTaxBenefitEur != null && leg.annualCommuterTaxBenefitEur > 0 ? (
            <>
              {" "}
              · Steuervorteil ca. {formatCommuteBenefitEur(leg.annualCommuterTaxBenefitEur)}/Jahr
              {leg.companyCarMarginalTaxRatePercent != null && (
                <> ({leg.companyCarMarginalTaxRatePercent} % Grenzsteuersatz)</>
              )}
            </>
          ) : (
            <> · voraussichtlich kein Zusatzvorteil über Werbungskosten-Pauschale (1.230 €)</>
          )}
          {leg.commuterAllowanceDaysSource != null && (
            <> · Pendeltage: {commuteDaysSourceLabel(leg.commuterAllowanceDaysSource)}</>
          )}
          . Keine Steuerberatung — Jobticket, Doppel-Haushalt u. a. Sonderfälle nicht berücksichtigt.
        </span>
      )}
    </p>
  );
}

function CommuteLegList({
  legs,
  showAllDetails = false,
}: {
  legs: CommuteLeg[];
  showAllDetails?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {legs.map((leg) => {
        const detailLines = leg.transitDetailTooltip
          ? leg.transitDetailTooltip.split("\n").filter(Boolean)
          : [];
        const showTransitDetails =
          Boolean(leg.connectionSummary) || detailLines.length > 0;

        return (
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
              {showTransitDetails ? (
                <CommuteTransitConnection
                  summary={leg.connectionSummary ?? "ÖPNV-Verbindung"}
                  detailLines={detailLines}
                  defaultExpanded={showAllDetails}
                />
              ) : null}
              {leg.routingNote && (
                <p className="text-xs text-pn-text-tertiary mt-1">{leg.routingNote}</p>
              )}
            </>
          ) : leg.routingNote ? (
            <div className="text-sm mt-2">
              {leg.distanceText && (
                <p>
                  <span className="font-medium">{leg.distanceText}</span>
                </p>
              )}
              <p className="text-pn-text-tertiary mt-1">({leg.routingNote})</p>
            </div>
          ) : (
            <p className="text-sm text-pn-text-tertiary mt-2">
              {commuteUnavailableMessage(leg.unavailableReason)}
            </p>
          )}
          <CommuteCompanyCarBenefit leg={leg} />
          {leg.commuteCostHint && (
            <p className="text-xs text-pn-text-tertiary mt-1">{leg.commuteCostHint}</p>
          )}
          {showAllDetails && (leg.routeKind || leg.effectiveMode) ? (
            <p className="text-xs text-pn-text-tertiary mt-2">
              {leg.routeKind ? `Route: ${leg.routeKind}` : null}
              {leg.routeKind && leg.effectiveMode ? " · " : null}
              {leg.effectiveMode ? `Effektiv: ${leg.effectiveMode}` : null}
            </p>
          ) : null}
        </li>
        );
      })}
    </ul>
  );
}

export function ApartmentCommutePanel({
  people,
  settingsHref,
  viewerIsAdmin = false,
}: {
  people: CommutePersonEstimate[];
  settingsHref: string;
  viewerIsAdmin?: boolean;
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
      subtitle={
        viewerIsAdmin
          ? "Geschätzte Anfahrt aller Projektmitglieder inkl. Verbindungsdetails (Admin-Ansicht)."
          : "Geschätzte Anfahrt pro Person — Verkehrsmittel und Ziele aus den jeweiligen Kontoeinstellungen."
      }
    >
      <div className="space-y-6">
        {people.map((person) => (
          <div key={person.userId}>
            <h3 className="text-sm font-semibold mb-0.5">
              {viewerIsAdmin || !person.isCurrentUser ? person.name : "Du"}
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
              <CommuteLegList legs={person.legs} showAllDetails={viewerIsAdmin} />
            )}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
