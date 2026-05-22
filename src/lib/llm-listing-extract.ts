import { callLlmChat } from "@/lib/llm-client";
import { resolveLlmSystemPrompt } from "@/lib/llm-settings";
import {
  parseEnergyClassInput,
  parsePlotSqmFromText,
  parseSqmFromText,
  type ListingPreviewFields,
} from "@/lib/listing-import";

export const LLM_LISTING_SOURCE_MAX_CHARS = 48_000;

export type LlmListingExtractRaw = {
  title?: string;
  price?: number;
  sizeSqm?: number;
  plotSizeSqm?: number;
  address?: string;
  energyClass?: string;
  highlights?: string;
  brokerInvolved?: boolean | null;
  hoaFeeMonthly?: number;
  heatingCostMonthly?: number;
  propertyTaxAnnual?: number;
  renovationCost?: number;
};

export function htmlToListingSourceText(html: string): string {
  const ogDesc =
    html.match(
      /<meta[^>]+(?:property|name)=["']og:description["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ?? "";
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
  return truncateListingSourceText(`${ogDesc}\n${stripped}`);
}

export function truncateListingSourceText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= LLM_LISTING_SOURCE_MAX_CHARS) return normalized;
  return normalized.slice(0, LLM_LISTING_SOURCE_MAX_CHARS);
}

export function mergeListingPreviewFields(
  base: ListingPreviewFields,
  extra: ListingPreviewFields
): ListingPreviewFields {
  const merged = { ...base };
  if (!merged.title && extra.title) merged.title = extra.title;
  if (merged.price == null && extra.price != null) merged.price = extra.price;
  if (merged.sizeSqm == null && extra.sizeSqm != null) merged.sizeSqm = extra.sizeSqm;
  if (merged.plotSizeSqm == null && extra.plotSizeSqm != null) {
    merged.plotSizeSqm = extra.plotSizeSqm;
  }
  if (!merged.address && extra.address) merged.address = extra.address;
  if (!merged.energyClass && extra.energyClass) merged.energyClass = extra.energyClass;
  if (merged.brokerInvolved == null && extra.brokerInvolved != null) {
    merged.brokerInvolved = extra.brokerInvolved;
  }
  if (merged.hoaFeeMonthly == null && extra.hoaFeeMonthly != null) {
    merged.hoaFeeMonthly = extra.hoaFeeMonthly;
  }
  if (merged.heatingCostMonthly == null && extra.heatingCostMonthly != null) {
    merged.heatingCostMonthly = extra.heatingCostMonthly;
  }
  if (merged.propertyTaxAnnual == null && extra.propertyTaxAnnual != null) {
    merged.propertyTaxAnnual = extra.propertyTaxAnnual;
  }
  if (merged.renovationCost == null && extra.renovationCost != null) {
    merged.renovationCost = extra.renovationCost;
  }
  return merged;
}

function parseGermanPriceFromLlm(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return undefined;
    const n = parseInt(digits, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return undefined;
}

export function normalizeLlmListingExtract(raw: LlmListingExtractRaw): ListingPreviewFields {
  const fields: ListingPreviewFields = {};
  if (typeof raw.title === "string" && raw.title.trim()) {
    fields.title = raw.title.trim().slice(0, 200);
  }
  const price = parseGermanPriceFromLlm(raw.price);
  if (price != null) fields.price = price;
  if (typeof raw.sizeSqm === "number" && raw.sizeSqm > 0) {
    fields.sizeSqm = Math.round(raw.sizeSqm);
  } else if (typeof raw.sizeSqm === "string") {
    const sqm = parseSqmFromText(raw.sizeSqm);
    if (sqm != null) fields.sizeSqm = sqm;
  }
  if (typeof raw.plotSizeSqm === "number" && raw.plotSizeSqm > 0) {
    fields.plotSizeSqm = Math.round(raw.plotSizeSqm);
  } else if (typeof raw.plotSizeSqm === "string") {
    const plot = parsePlotSqmFromText(raw.plotSizeSqm);
    if (plot != null) fields.plotSizeSqm = plot;
  }
  if (typeof raw.address === "string" && raw.address.trim()) {
    fields.address = raw.address.trim().slice(0, 300);
  }
  if (typeof raw.energyClass === "string") {
    const ec = parseEnergyClassInput(raw.energyClass);
    if (ec) fields.energyClass = ec;
  }
  if (typeof raw.brokerInvolved === "boolean") {
    fields.brokerInvolved = raw.brokerInvolved;
  }
  const hoaFeeMonthly = parseGermanPriceFromLlm(raw.hoaFeeMonthly);
  if (hoaFeeMonthly != null) fields.hoaFeeMonthly = hoaFeeMonthly;
  const heatingCostMonthly = parseGermanPriceFromLlm(raw.heatingCostMonthly);
  if (heatingCostMonthly != null) fields.heatingCostMonthly = heatingCostMonthly;
  const propertyTaxAnnual = parseGermanPriceFromLlm(raw.propertyTaxAnnual);
  if (propertyTaxAnnual != null) fields.propertyTaxAnnual = propertyTaxAnnual;
  const renovationCost = parseGermanPriceFromLlm(raw.renovationCost);
  if (renovationCost != null) fields.renovationCost = renovationCost;
  return fields;
}

export function parseLlmListingJson(content: string): LlmListingExtractRaw | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  try {
    const parsed = JSON.parse(candidate) as LlmListingExtractRaw;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as LlmListingExtractRaw;
    } catch {
      return null;
    }
  }
}

const LISTING_EXTRACT_TASK = `Extrahiere strukturierte Immobiliendaten aus dem folgenden Exposé- oder Inseratstext.
Antworte NUR mit einem JSON-Objekt (kein Markdown), Schema:
{
  "title": string | null,
  "price": number | null,
  "sizeSqm": number | null,
  "plotSizeSqm": number | null,
  "address": string | null,
  "energyClass": string | null,
  "highlights": string | null,
  "brokerInvolved": boolean | null,
  "hoaFeeMonthly": number | null,
  "heatingCostMonthly": number | null,
  "propertyTaxAnnual": number | null,
  "renovationCost": number | null
}
Regeln:
- price: Kaufpreis oder Kaltmiete in Euro als Ganzzahl ohne Cent
- sizeSqm: Wohnfläche in m² als Ganzzahl
- plotSizeSqm: Grundstücksfläche in m² als Ganzzahl (nicht Wohnfläche)
- energyClass: genau ein Wert aus A+, A, B, C, D, E, F, G, H (Energieeffizienzklasse / Endenergiebedarf-Klasse) — nur Buchstabe mit optionalem Plus, kein Verbrauch (kWh), kein Primärenergie-Faktor, keine Spanne; bei A++ im Text → A+; sonst null
- brokerInvolved: true bei Maklerprovision/Käuferprovision/provisionspflichtig; false bei provisionsfrei/von privat/ohne Makler; sonst null
- hoaFeeMonthly: Hausgeld / WEG / monatliche Betriebskosten in Euro (ganzzahlig)
- heatingCostMonthly: Heizkosten pro Monat in Euro, nur wenn monatlich genannt
- propertyTaxAnnual: laufende Grundsteuer pro Jahr in Euro — nicht Grunderwerbsteuer
- renovationCost: Sanierungs- oder Renovierungskosten einmalig in Euro, nur wenn explizit genannt
- address: Standort der Immobilie (PLZ, Stadt, ggf. Stadtteil/Straße aus Lage-Beschreibung) — NICHT Büroadresse, Impressum oder Anschrift des Maklers/Anbieters (oft andere PLZ als die Immobilie)
- Wenn nur Stadtteil und PLZ bekannt: "Stadtteil, PLZ Stadt" (z. B. "Nordstadt, 99999 Teststadt")
- Nur Felder setzen, die im Text klar vorkommen; sonst null
- highlights: max. 3 kurze Stichpunkte zu Besonderheiten/Risiken (ein String)`;

export async function extractListingFieldsWithLlm(
  sourceText: string
): Promise<{ fields: ListingPreviewFields; highlights?: string } | null> {
  const text = truncateListingSourceText(sourceText);
  if (text.length < 80) return null;

  const basePrompt = await resolveLlmSystemPrompt();
  const result = await callLlmChat(
    [
      { role: "system", content: `${basePrompt}\n\n${LISTING_EXTRACT_TASK}` },
      {
        role: "user",
        content: `Quelle:\n\n${text}`,
      },
    ],
    { maxTokens: 1024, temperature: 0.1 }
  );

  if (!result.ok) return null;

  const raw = parseLlmListingJson(result.content);
  if (!raw) return null;

  const fields = normalizeLlmListingExtract(raw);
  const hasAny =
    fields.title ||
    fields.price ||
    fields.sizeSqm ||
    fields.plotSizeSqm ||
    fields.address ||
    fields.energyClass ||
    fields.hoaFeeMonthly ||
    fields.heatingCostMonthly ||
    fields.propertyTaxAnnual ||
    fields.renovationCost;
  if (!hasAny && !raw.highlights?.trim()) return null;

  return {
    fields,
    highlights: typeof raw.highlights === "string" ? raw.highlights.trim().slice(0, 500) : undefined,
  };
}

export async function enrichListingFieldsWithLlm(
  base: ListingPreviewFields,
  sourceText: string
): Promise<{ fields: ListingPreviewFields; llmUsed: boolean; highlights?: string }> {
  const llm = await extractListingFieldsWithLlm(sourceText);
  if (!llm) {
    return { fields: base, llmUsed: false };
  }
  return {
    fields: mergeListingPreviewFields(base, llm.fields),
    llmUsed: true,
    highlights: llm.highlights,
  };
}
