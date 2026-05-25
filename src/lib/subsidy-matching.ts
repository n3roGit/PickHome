import {
  SUBSIDY_PROGRAMS,
  type SubsidyProgram,
  type SubsidyProgramId,
} from "@/lib/subsidy-programs";

export type SubsidyMatchStatus = "relevant" | "possible" | "needs-data";

export type SubsidyMatch = {
  program: SubsidyProgram;
  status: SubsidyMatchStatus;
  reason: string;
  missingData: string[];
  nextStep: string;
};

export type ApartmentSubsidyInput = {
  energyClass?: string | null;
  yearBuilt?: number | null;
  renovationCost?: number | null;
  address?: string | null;
};

const GOOD_ENERGY_CLASSES = new Set(["A+", "A"]);
const POOR_ENERGY_CLASSES = new Set(["B", "C", "D", "E", "F", "G", "H"]);

function currentYear(): number {
  return new Date().getFullYear();
}

function isLikelyNewBuild(yearBuilt: number | null | undefined): boolean {
  if (yearBuilt == null) return false;
  return yearBuilt >= currentYear() - 3;
}

function isLikelyExistingBuild(yearBuilt: number | null | undefined): boolean {
  if (yearBuilt == null) return false;
  return yearBuilt < currentYear() - 3;
}

function hasGoodEnergyClass(energyClass: string | null | undefined): boolean {
  if (!energyClass) return false;
  return GOOD_ENERGY_CLASSES.has(energyClass.trim().toUpperCase());
}

function hasPoorEnergyClass(energyClass: string | null | undefined): boolean {
  if (!energyClass) return false;
  return POOR_ENERGY_CLASSES.has(energyClass.trim().toUpperCase());
}

function hasRenovationCost(renovationCost: number | null | undefined): boolean {
  return renovationCost != null && renovationCost > 0;
}

function hasEnergySignals(input: ApartmentSubsidyInput): boolean {
  return (
    input.yearBuilt != null ||
    (input.energyClass != null && input.energyClass.trim() !== "") ||
    hasRenovationCost(input.renovationCost)
  );
}

function buildMatch(
  id: SubsidyProgramId,
  status: SubsidyMatchStatus,
  reason: string,
  missingData: string[],
  nextStep: string
): SubsidyMatch {
  return {
    program: SUBSIDY_PROGRAMS[id],
    status,
    reason,
    missingData,
    nextStep,
  };
}

function matchKfw124(): SubsidyMatch {
  return buildMatch(
    "kfw-124",
    "possible",
    "Grundprogramm für Kauf oder Bau selbstgenutzten Wohneigentums.",
    ["Selbstnutzung (nicht in PickHome gespeichert)"],
    "KfW-Vorab-Check und Finanzierungspartner kontaktieren."
  );
}

function matchKfw300(input: ApartmentSubsidyInput): SubsidyMatch {
  const newBuild = isLikelyNewBuild(input.yearBuilt);
  const goodEnergy = hasGoodEnergyClass(input.energyClass);

  if (newBuild || goodEnergy) {
    return buildMatch(
      "kfw-300",
      "possible",
      newBuild
        ? "Baujahr deutet auf Neubau oder Ersterwerb hin."
        : "Energieklasse deutet auf klimafreundliches Gebäude hin.",
      ["Kinder im Haushalt", "Haushaltseinkommen", "Gebäudestandard-Nachweis"],
      "KfW-Vorab-Check für Familienförderung durchführen."
    );
  }

  if (!hasEnergySignals(input)) {
    return buildMatch(
      "kfw-300",
      "needs-data",
      "Familienförderung gilt für klimafreundlichen Neubau – Daten fehlen noch.",
      ["Baujahr", "Energieklasse"],
      "Baujahr und Energieklasse ergänzen, dann erneut prüfen."
    );
  }

  return buildMatch(
    "kfw-300",
    "needs-data",
    "Programm richtet sich an klimafreundlichen Neubau; aktuelle Daten passen nicht eindeutig.",
    ["Neubau-Indizien (Baujahr oder Energieklasse A/A+)"],
    "Bei Neubau/Ersterwerb KfW-Vorab-Check prüfen."
  );
}

function matchKfw297(input: ApartmentSubsidyInput): SubsidyMatch {
  const newBuild = isLikelyNewBuild(input.yearBuilt);
  const goodEnergy = hasGoodEnergyClass(input.energyClass);

  if (newBuild && goodEnergy) {
    return buildMatch(
      "kfw-297",
      "possible",
      "Neubau-Indizien und gute Energieklasse passen zu klimafreundlichem Neubau (Eigennutzung).",
      ["EH/QNG-Nachweis", "Antrag vor Kaufvertrag"],
      "Energieeffizienz-Experten einbinden und Finanzierungspartner kontaktieren."
    );
  }

  if (newBuild || goodEnergy) {
    return buildMatch(
      "kfw-297",
      "possible",
      newBuild
        ? "Baujahr deutet auf Neubau hin – EH/QNG-Nachweis noch offen."
        : "Energieklasse A/A+ deutet auf klimafreundlichen Standard hin.",
      ["EH/QNG-Nachweis", "Bestätigung Neubau/Ersterwerb"],
      "Technischen Nachweis beim Energieberater klären."
    );
  }

  if (!hasEnergySignals(input)) {
    return buildMatch(
      "kfw-297",
      "needs-data",
      "Neubau-Förderung – ohne Baujahr oder Energieklasse nicht einschätzbar.",
      ["Baujahr", "Energieklasse"],
      "Stammdaten ergänzen und erneut prüfen."
    );
  }

  return buildMatch(
    "kfw-297",
    "needs-data",
    "Keine klaren Neubau-Indizien in den vorhandenen Daten.",
    ["Baujahr (Neubau)", "Energieklasse A oder A+"],
    "Bei Neubau/Ersterwerb Daten ergänzen."
  );
}

function matchKfw298(input: ApartmentSubsidyInput): SubsidyMatch {
  const match297 = matchKfw297(input);
  return {
    ...match297,
    program: SUBSIDY_PROGRAMS["kfw-298"],
    reason: match297.reason.replace("Eigennutzung", "Vermietung/Investition"),
    nextStep: match297.nextStep.replace(
      "Finanzierungspartner kontaktieren.",
      "Bei Vermietung Finanzierungspartner kontaktieren."
    ),
  };
}

function matchRenovationPrograms(input: ApartmentSubsidyInput): SubsidyMatch[] {
  const existing = isLikelyExistingBuild(input.yearBuilt);
  const poorEnergy = hasPoorEnergyClass(input.energyClass);
  const renovation = hasRenovationCost(input.renovationCost);
  const likelyExisting = existing || poorEnergy || renovation;

  if (renovation) {
    return [
      buildMatch(
        "kfw-261",
        "relevant",
        "Sanierungskosten sind eingetragen – energetische Gesamtsanierung könnte passen.",
        ["Sanierungskonzept", "Effizienzhaus-Ziel", "Energieeffizienz-Experte"],
        "Energieeffizienz-Experten für Sanierungsfahrplan beauftragen."
      ),
      buildMatch(
        "kfw-458",
        "relevant",
        "Sanierungskosten deuten auf geplanten Heizungs- oder Energieumbau hin.",
        ["Heizungsart (aktuell/geplant)", "Antrag vor Vertragsabschluss"],
        "KfW-Vorab-Check für Heizungsförderung öffnen."
      ),
      buildMatch(
        "bafa-beg-em",
        "relevant",
        "Sanierungskosten deuten auf Einzelmaßnahmen (Dämmung, Fenster, Heizungsoptimierung) hin.",
        ["Konkrete Maßnahme", "TPB-ID vom Fachunternehmen"],
        "BAFA-Portal: Antrag vor Maßnahmenbeginn stellen."
      ),
    ];
  }

  if (likelyExisting) {
    const reason = existing
      ? "Baujahr deutet auf Bestandsgebäude hin."
      : poorEnergy
        ? "Energieklasse deutet auf Sanierungspotenzial hin."
        : "Bestands-Indizien vorhanden.";

    return [
      buildMatch(
        "kfw-261",
        "possible",
        reason,
        ["Sanierungskonzept", "Effizienzhaus-Ziel"],
        "Sanierungsbedarf mit Energieberater klären."
      ),
      buildMatch(
        "kfw-458",
        "possible",
        `${reason} Heizungstausch könnte förderfähig sein.`,
        ["Heizungsart", "Alter der Heizung"],
        "KfW-Vorab-Check für Heizungsförderung prüfen."
      ),
      buildMatch(
        "bafa-beg-em",
        "possible",
        `${reason} Einzelmaßnahmen an Gebäudehülle oder Anlagentechnik möglich.`,
        ["Geplante Maßnahme", "Kostenschätzung"],
        "BAFA-Infoblatt zu förderfähigen Maßnahmen lesen."
      ),
    ];
  }

  if (!hasEnergySignals(input)) {
    return [
      buildMatch(
        "kfw-261",
        "needs-data",
        "Sanierungsförderung – ohne Gebäudedaten nicht einschätzbar.",
        ["Baujahr", "Energieklasse", "Sanierungskosten"],
        "Stammdaten ergänzen."
      ),
      buildMatch(
        "kfw-458",
        "needs-data",
        "Heizungsförderung für Bestand – Heizungsart unbekannt.",
        ["Baujahr", "Heizungsart"],
        "Baujahr und geplanten Heizungstausch prüfen."
      ),
      buildMatch(
        "bafa-beg-em",
        "needs-data",
        "Einzelmaßnahmen-Förderung – ohne Sanierungssignale nicht einschätzbar.",
        ["Sanierungskosten oder Energieklasse"],
        "Geplante Maßnahmen und Kosten grob eintragen."
      ),
    ];
  }

  return [];
}

function matchRegionalWithAddress(input: ApartmentSubsidyInput): SubsidyMatch {
  const hasAddress = input.address != null && input.address.trim().length > 0;
  return buildMatch(
    "regional-fdb",
    "possible",
    hasAddress
      ? "Adresse vorhanden – regionale Programme können gezielt gesucht werden."
      : "Regionale Programme hängen oft von PLZ und Bundesland ab.",
    hasAddress ? [] : ["Adresse mit PLZ"],
    "Förderdatenbank nach PLZ und Vorhaben durchsuchen."
  );
}

const STATUS_ORDER: Record<SubsidyMatchStatus, number> = {
  relevant: 0,
  possible: 1,
  "needs-data": 2,
};

export function matchApartmentSubsidies(input: ApartmentSubsidyInput): SubsidyMatch[] {
  const matches: SubsidyMatch[] = [
    matchKfw124(),
    matchKfw300(input),
    matchKfw297(input),
    matchKfw298(input),
    ...matchRenovationPrograms(input),
    matchRegionalWithAddress(input),
  ];

  const seen = new Set<SubsidyProgramId>();
  const deduped: SubsidyMatch[] = [];
  for (const match of matches) {
    if (seen.has(match.program.id)) continue;
    seen.add(match.program.id);
    deduped.push(match);
  }

  return deduped.sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.program.name.localeCompare(b.program.name, "de");
  });
}

export function countSubsidyHints(matches: SubsidyMatch[]): number {
  return matches.length;
}
