import {
  commuteUnavailableMessage,
  type CommutePersonEstimate,
} from "@/lib/commute";
import { formatCommuteBenefitEur } from "@/lib/company-car";
import { travelModeLabel } from "@/lib/travel-mode";

export function buildApartmentCommuteLlmSection(people: CommutePersonEstimate[]): string {
  if (people.length === 0) return "";

  const lines: string[] = [
    "--- Fahrtwege (PickHome-Schätzung - Verkehr und ÖPNV können abweichen) ---",
    "Hinweis: Zeiten und Verbindungen sind Schätzungen aus dem PickHome-Cache, keine Garantie.",
  ];

  for (const person of people) {
    lines.push(`${person.name} (${travelModeLabel(person.travelMode)}):`);
    if (person.legs.length === 0) {
      lines.push("- Keine Arbeitsadressen hinterlegt");
      continue;
    }

    for (const leg of person.legs) {
      if (leg.durationText) {
        const distancePart = leg.distanceText ? `${leg.distanceText}, ` : "";
        let line = `- ${leg.label}: ${distancePart}ca. ${leg.durationText}`;
        if (leg.connectionSummary) {
          line += `, ${leg.connectionSummary}`;
        }
        lines.push(line);
        if (leg.routingNote) {
          lines.push(`  Hinweis: ${leg.routingNote}`);
        }
      } else {
        const reason =
          commuteUnavailableMessage(leg.unavailableReason) ?? "Route noch nicht berechnet";
        lines.push(`- ${leg.label}: ${reason}`);
      }

      if (leg.monthlyCompanyCarTotalBenefitEur != null) {
        lines.push(
          `  Firmenwagen (ca., keine Steuerberatung): Brutto ca. ${formatCommuteBenefitEur(leg.monthlyCompanyCarTotalBenefitEur)}/Monat`
        );
      }
      if (leg.annualCommuterAllowanceEur != null) {
        lines.push(
          `  Pendlerpauschale (ca., Steuererklärung): ca. ${formatCommuteBenefitEur(leg.annualCommuterAllowanceEur)}/Jahr`
        );
      }
    }
  }

  return lines.join("\n");
}
