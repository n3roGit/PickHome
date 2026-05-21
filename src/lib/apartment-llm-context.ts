import { formatPrice } from "@/lib/scoring";

export const APARTMENT_LLM_CONTEXT_MAX_CHARS = 96_000;

export type ApartmentLlmContextInput = {
  projectName: string;
  title: string;
  address?: string | null;
  listingUrl?: string | null;
  price?: number | null;
  sizeSqm?: number | null;
  floor?: number | null;
  yearBuilt?: number | null;
  energyClass?: string | null;
  brokerInvolved?: boolean;
  description?: string | null;
  notes?: string | null;
  documents?: { fileName: string; extractedText?: string | null }[];
};

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
  push("Etage", apartment.floor);
  push("Baujahr", apartment.yearBuilt);
  push("Energieklasse", apartment.energyClass);
  if (apartment.brokerInvolved) lines.push("Makler: ja");

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

  return truncateApartmentLlmContext(lines.join("\n"));
}

export function truncateApartmentLlmContext(text: string): string {
  if (text.length <= APARTMENT_LLM_CONTEXT_MAX_CHARS) return text;
  const head = text.slice(0, Math.floor(APARTMENT_LLM_CONTEXT_MAX_CHARS * 0.85));
  return `${head}\n\n[… Text gekürzt …]`;
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
