import {
  apartmentMonthlyMaintenance,
  estimateAffordability,
  estimateFinancing,
  estimatePurchaseCosts,
  formatBurdenShare,
  formatPercent,
  resolveFederalStateCode,
  resolvePropertyTaxAnnual,
  totalAcquisitionCost,
  type ProjectFinanceSettings,
} from "@/lib/purchase-costs";
import { formatPrice } from "@/lib/scoring";

export type ApartmentLlmFinanceApartmentInput = {
  price: number | null;
  address: string | null;
  brokerInvolved: boolean;
  hoaFeeMonthly: number | null;
  heatingCostMonthly: number | null;
  propertyTaxAnnual: number | null;
  renovationCost: number | null;
  sizeSqm: number | null;
  plotSizeSqm: number | null;
};

export function buildApartmentFinanceLlmSection(
  apartment: ApartmentLlmFinanceApartmentInput,
  finance: ProjectFinanceSettings
): string {
  const lines: string[] = [
    "--- Finanz-Schätzung (PickHome, grobe Orientierung - keine verbindliche Kalkulation) ---",
    "Hinweis: Alle Beträge sind Schätzungen auf Basis der Projekt-Annahmen und erfassten Stammdaten.",
  ];
  const missing: string[] = [];

  const assumptionParts: string[] = [];
  if (finance.equityAmount != null) {
    assumptionParts.push(`Eigenkapital ${formatPrice(finance.equityAmount)}`);
  } else {
    missing.push("Eigenkapital nicht hinterlegt");
  }
  if (finance.loanTermYears != null) {
    assumptionParts.push(`Laufzeit ${finance.loanTermYears} Jahre`);
  } else {
    missing.push("Abzahlungszeitraum nicht hinterlegt");
  }
  if (finance.interestRate != null) {
    assumptionParts.push(`Sollzins ${formatPercent(finance.interestRate)}`);
  } else {
    assumptionParts.push("Sollzins 3,5 % (PickHome-Standard)");
  }
  if (finance.netHouseholdIncome != null) {
    assumptionParts.push(`Haushaltsnetto ${formatPrice(finance.netHouseholdIncome)}/Monat`);
  } else {
    missing.push("Haushaltsnetto nicht hinterlegt");
  }
  if (finance.monthlyFixedCosts != null && finance.monthlyFixedCosts > 0) {
    assumptionParts.push(`Fixkosten Lebenshaltung ${formatPrice(finance.monthlyFixedCosts)}/Monat`);
  }
  if (finance.federalStateCode) {
    assumptionParts.push(`Bundesland ${finance.federalStateCode}`);
  }

  lines.push(`Annahmen (Projekt): ${assumptionParts.join("; ")}`);

  const stateCode = resolveFederalStateCode({
    projectFederalStateCode: finance.federalStateCode,
    apartmentAddress: apartment.address,
  });

  if (apartment.price == null) {
    missing.push("Kaufpreis fehlt");
  }
  if (!stateCode) {
    missing.push("Bundesland nicht ableitbar");
  }

  if (apartment.price != null && stateCode) {
    const costs = estimatePurchaseCosts({
      price: apartment.price,
      federalStateCode: stateCode,
      brokerInvolved: apartment.brokerInvolved,
      brokerBuyerRate: finance.brokerBuyerRate,
    });
    const acquisitionTotal = totalAcquisitionCost(costs, apartment.renovationCost);

    const costParts = costs.lines.map((l) => `${l.label} ${formatPrice(l.amount)}`);
    lines.push(
      `Kaufnebenkosten (grob): ${costParts.join("; ")} -> Summe ${formatPrice(costs.ancillaryTotal)}`
    );
    lines.push(
      `Gesamtkosten: Kaufpreis ${formatPrice(apartment.price)} + Nebenkosten ${formatPrice(costs.ancillaryTotal)}${
        apartment.renovationCost ? ` + Renovierung ${formatPrice(apartment.renovationCost)}` : ""
      } = ${formatPrice(acquisitionTotal)}`
    );

    if (finance.equityAmount != null && finance.loanTermYears != null) {
      const financing = estimateFinancing({
        totalCost: acquisitionTotal,
        equityAmount: finance.equityAmount,
        loanTermYears: finance.loanTermYears,
        interestRate: finance.interestRate,
      });
      if (financing) {
        const rateNote = financing.interestRateIsDefault ? " (Standard-Zins)" : "";
        lines.push(
          `Finanzierung: Kreditsumme ${formatPrice(financing.loanAmount)}; Monatsrate grob ${formatPrice(financing.monthlyPayment)}; Sollzins ${formatPercent(financing.interestRate)}${rateNote}`
        );

        const ongoingCosts = {
          hoaFeeMonthly: apartment.hoaFeeMonthly,
          heatingCostMonthly: apartment.heatingCostMonthly,
          propertyTaxAnnual: apartment.propertyTaxAnnual,
          price: apartment.price,
          sizeSqm: apartment.sizeSqm,
          plotSizeSqm: apartment.plotSizeSqm,
        };
        const propertyTax = resolvePropertyTaxAnnual(ongoingCosts);
        const monthlyMaintenance = apartmentMonthlyMaintenance(ongoingCosts);
        const maintenanceParts: string[] = [];
        if (apartment.hoaFeeMonthly != null) {
          maintenanceParts.push(`Hausgeld ${formatPrice(apartment.hoaFeeMonthly)}`);
        }
        if (apartment.heatingCostMonthly != null) {
          maintenanceParts.push(`Heizung ${formatPrice(apartment.heatingCostMonthly)}`);
        }
        if (propertyTax.annual != null) {
          const taxLabel = propertyTax.isEstimate
            ? `Grundsteuer ca. ${formatPrice(Math.round(propertyTax.annual / 12))}/Monat (geschätzt)`
            : `Grundsteuer ${formatPrice(Math.round(propertyTax.annual / 12))}/Monat`;
          maintenanceParts.push(taxLabel);
        }
        if (maintenanceParts.length > 0) {
          lines.push(`Wohnkosten/Monat: ${maintenanceParts.join("; ")}`);
        }

        if (finance.netHouseholdIncome != null) {
          const affordability = estimateAffordability({
            monthlyPayment: financing.monthlyPayment,
            netHouseholdIncome: finance.netHouseholdIncome,
            monthlyMaintenance,
            monthlyFixedCosts: finance.monthlyFixedCosts,
          });
          if (affordability) {
            const fixedPart =
              affordability.monthlyFixedCosts > 0
                ? ` + Fixkosten ${formatPrice(affordability.monthlyFixedCosts)}`
                : "";
            lines.push(
              `Gesamtbelastung/Monat: Rate ${formatPrice(financing.monthlyPayment)} + Wohnkosten ${formatPrice(monthlyMaintenance)}${fixedPart} = ${formatPrice(affordability.totalMonthlyBurden)}`
            );
            lines.push(
              `Belastungsquote: ${formatBurdenShare(affordability.burdenShare)} vom Netto (Richtwert <= ca. 35 %); Rest nach allen Kosten: ${formatPrice(affordability.remainingMonthly)}/Monat`
            );
          }
        }
      }
    }
  }

  if (missing.length > 0) {
    lines.push(`Fehlende Daten: ${missing.join("; ")}`);
  }

  return lines.join("\n");
}
