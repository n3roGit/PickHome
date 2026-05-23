import {
  apartmentScore,
  formatPrice,
  resolveDealbreakerThreshold,
  type CriterionInput,
} from "@/lib/scoring";

export const APARTMENT_LLM_CONTEXT_MAX_CHARS = 96_000;

export type ApartmentLlmScoringMember = {
  userId: string;
  name: string;
};

export type ApartmentLlmScoringRating = {
  criterionId: string;
  userId: string;
  score: number | null;
  note?: string | null;
};

export type ApartmentLlmScoringGroup = {
  name: string;
  criteria: {
    id: string;
    name: string;
    weight: number;
    isDealbreaker: boolean;
  }[];
};

export type ApartmentLlmScoringInput = {
  dealbreakerThreshold?: number | null;
  groups: ApartmentLlmScoringGroup[];
  ratings: ApartmentLlmScoringRating[];
  members: ApartmentLlmScoringMember[];
  focusUserId: string;
};

export type ApartmentLlmContextInput = {
  projectName: string;
  title: string;
  scoring?: ApartmentLlmScoringInput | null;
  address?: string | null;
  listingUrl?: string | null;
  price?: number | null;
  sizeSqm?: number | null;
  plotSizeSqm?: number | null;
  floor?: number | null;
  yearBuilt?: number | null;
  energyClass?: string | null;
  brokerInvolved?: boolean;
  hoaFeeMonthly?: number | null;
  heatingCostMonthly?: number | null;
  propertyTaxAnnual?: number | null;
  renovationCost?: number | null;
  description?: string | null;
  notes?: string | null;
  documents?: { fileName: string; extractedText?: string | null }[];
};

function memberName(members: ApartmentLlmScoringMember[], userId: string): string {
  return members.find((m) => m.userId === userId)?.name?.trim() || "Nutzer";
}

function formatRatingScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "nicht bewertet";
  return `${score}/10`;
}

/** Project criteria, weights, and team ratings for the apartment LLM context. */
export function buildApartmentScoringLlmSection(scoring: ApartmentLlmScoringInput): string {
  const criteriaFlat: CriterionInput[] = scoring.groups.flatMap((g) =>
    g.criteria.map((c) => ({
      id: c.id,
      weight: c.weight,
      isDealbreaker: c.isDealbreaker,
    }))
  );
  if (criteriaFlat.length === 0) return "";

  const threshold = resolveDealbreakerThreshold(scoring.dealbreakerThreshold);
  const lines: string[] = [
    "--- Bewertungskriterien (PickHome) ---",
    `Skala pro Kriterium: 0–10. Gewicht pro Kriterium: 1 (gering) bis 5 (hoch).`,
    `Dealbreaker-Schwelle: Wert ≤ ${threshold} bei als Dealbreaker markierten Kriterien → Gesamtscore 0.`,
  ];

  const ratingsForScore = scoring.ratings.map((r) => ({
    criterionId: r.criterionId,
    userId: r.userId,
    score: r.score,
  }));

  for (const member of scoring.members) {
    const { score, displayScore, dealbreaker, rated, total } = apartmentScore(
      criteriaFlat,
      ratingsForScore,
      member.userId,
      threshold
    );
    const db = dealbreaker ? ", Dealbreaker aktiv" : "";
    lines.push(
      `Gesamtscore ${member.name}: ${displayScore} % (${rated}/${total} Kriterien bewertet${db}; intern ${score}).`
    );
  }

  lines.push("");
  lines.push(
    "Kriterien (Gruppe | Name | Gewicht | Dealbreaker | Bewertungen der Teammitglieder):"
  );

  for (const group of scoring.groups) {
    for (const criterion of group.criteria) {
      const flags = criterion.isDealbreaker ? "ja" : "nein";
      let line = `- [${group.name}] ${criterion.name} | Gewicht ${criterion.weight} | Dealbreaker ${flags} |`;
      const ratingParts: string[] = [];
      for (const member of scoring.members) {
        const rating = scoring.ratings.find(
          (r) => r.criterionId === criterion.id && r.userId === member.userId
        );
        const scoreLabel = formatRatingScore(rating?.score);
        const note = rating?.note?.trim();
        ratingParts.push(
          note ? `${member.name}: ${scoreLabel} (Notiz: ${note})` : `${member.name}: ${scoreLabel}`
        );
      }
      line += ` ${ratingParts.join("; ")}`;
      lines.push(line);
    }
  }

  const focusName = memberName(scoring.members, scoring.focusUserId);
  lines.push(
    "",
    `Für Rückfragen zur persönlichen Einschätzung beziehe dich primär auf die Bewertungen von ${focusName}.`
  );

  return lines.join("\n");
}

export function buildApartmentLlmContext(apartment: ApartmentLlmContextInput): string {
  const lines: string[] = [
    `Projekt: ${apartment.projectName}`,
    `Titel: ${apartment.title}`,
  ];

  const push = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    lines.push(`${label}: ${value}`);
  };

  push("Adresse", apartment.address);
  push("Inserat-URL", apartment.listingUrl);
  if (apartment.price != null) push("Preis", formatPrice(apartment.price));
  push("Wohnfläche m²", apartment.sizeSqm);
  push("Grundstücksfläche m²", apartment.plotSizeSqm);
  push("Etage", apartment.floor);
  push("Baujahr", apartment.yearBuilt);
  push("Energieklasse", apartment.energyClass);
  if (apartment.brokerInvolved) lines.push("Makler: ja");
  if (apartment.hoaFeeMonthly != null) {
    push("Hausgeld monatlich", formatPrice(apartment.hoaFeeMonthly));
  }
  if (apartment.heatingCostMonthly != null) {
    push("Heizkosten monatlich", formatPrice(apartment.heatingCostMonthly));
  }
  if (apartment.propertyTaxAnnual != null) {
    push("Grundsteuer jährlich", formatPrice(apartment.propertyTaxAnnual));
  }
  if (apartment.renovationCost != null) {
    push("Renovierung (eingetragen)", formatPrice(apartment.renovationCost));
  }

  if (apartment.description?.trim()) {
    lines.push("", "Beschreibung:", apartment.description.trim());
  }
  if (apartment.notes?.trim()) {
    lines.push("", "Eigene Notizen:", apartment.notes.trim());
  }

  const docSections: string[] = [];
  for (const doc of apartment.documents ?? []) {
    const text = doc.extractedText?.trim();
    if (!text) continue;
    docSections.push(`--- ${doc.fileName} ---\n${text}`);
  }

  if (docSections.length > 0) {
    lines.push("", "Exposé / Dokumente (Volltext):", ...docSections);
  }

  if (apartment.scoring?.groups.length) {
    const scoringSection = buildApartmentScoringLlmSection(apartment.scoring);
    if (scoringSection) {
      lines.push("", scoringSection);
    }
  }

  return truncateApartmentLlmContext(lines.join("\n"));
}

export function truncateApartmentLlmContext(text: string): string {
  if (text.length <= APARTMENT_LLM_CONTEXT_MAX_CHARS) return text;
  const head = text.slice(0, Math.floor(APARTMENT_LLM_CONTEXT_MAX_CHARS * 0.85));
  return `${head}\n\n[… Text gekürzt …]`;
}

export type ApartmentListingExtractSupplementOptions = {
  checklistLines?: string[];
  /** Skip PDF bodies when PDF text is processed separately in listing import. */
  omitDocumentBodies?: boolean;
  /**
   * For listing extract only: omit structured Stammdaten (price, m², …) so the model
   * does not anchor on current form values. Notes, description, and checklist stay.
   */
  narrativeOnly?: boolean;
};

/** Context from saved apartment data for detail-page Auto-Fill (not used on project quick-add). */
export function buildApartmentListingExtractSupplement(
  apartment: ApartmentLlmContextInput,
  options?: ApartmentListingExtractSupplementOptions
): string {
  const apt: ApartmentLlmContextInput = options?.omitDocumentBodies
    ? { ...apartment, documents: [] }
    : apartment;

  const checklist = options?.checklistLines?.filter((l) => l.trim());

  if (options?.narrativeOnly) {
    const sections: string[] = [
      "--- Bereits in PickHome (nur Freitext — keine Stammdaten als Vorgabe; bei Widerspruch Inserat/PDF bevorzugen) ---",
      `Immobilie: ${apt.title}`,
    ];
    if (apt.description?.trim()) {
      sections.push("", "Beschreibung:", apt.description.trim());
    }
    if (apt.notes?.trim()) {
      sections.push("", "Eigene Notizen:", apt.notes.trim());
    }
    if (!options.omitDocumentBodies) {
      for (const doc of apt.documents ?? []) {
        const text = doc.extractedText?.trim();
        if (!text) continue;
        sections.push("", `--- ${doc.fileName} ---`, text);
      }
    }
    if (checklist?.length) {
      sections.push("", "Checkliste:", ...checklist);
    }
    return truncateApartmentLlmContext(sections.join("\n"));
  }

  const sections: string[] = [
    "--- Bereits in PickHome erfasst (Notizen, Stammdaten, Checkliste; bei Widerspruch Inserat/PDF bevorzugen) ---",
    buildApartmentLlmContext(apt),
  ];

  if (checklist?.length) {
    sections.push("", "Checkliste:", ...checklist);
  }

  return truncateApartmentLlmContext(sections.join("\n"));
}

export function apartmentLlmHasSourceText(apartment: ApartmentLlmContextInput): boolean {
  if (apartment.description?.trim()) return true;
  if (apartment.notes?.trim()) return true;
  if ((apartment.documents ?? []).some((d) => d.extractedText?.trim())) return true;
  const hasTitle = Boolean(apartment.title?.trim());
  const hasStructured =
    apartment.address?.trim() ||
    apartment.listingUrl?.trim() ||
    apartment.price != null ||
    apartment.sizeSqm != null ||
    apartment.energyClass?.trim();
  return hasTitle && Boolean(hasStructured);
}
