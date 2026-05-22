import { fetchExternal } from "@/lib/external-fetch";
import {
  extractRelaxedJsonLdListingName,
  extractRelaxedJsonLdPropertyAddress,
  isBrokerOfficeAddress,
  pickPropertyListingAddress,
} from "@/lib/listing-address";
import { enrichListingFieldsWithLlm, htmlToListingSourceText } from "@/lib/llm-listing-extract";
import { isLlmConfigured } from "@/lib/llm-client";
import { normalizeListingUrl } from "@/lib/listing-url";

export type ListingPreviewFields = {
  title?: string;
  price?: number;
  sizeSqm?: number;
  plotSizeSqm?: number;
  address?: string;
  energyClass?: string;
  description?: string;
  brokerInvolved?: boolean;
  hoaFeeMonthly?: number;
  heatingCostMonthly?: number;
  propertyTaxAnnual?: number;
  renovationCost?: number;
};

function parseEuroAmountFromLabel(text: string, patterns: RegExp[]): number | undefined {
  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const n = parseGermanPrice(m[1]);
    if (n != null && n > 0) return n;
  }
  return undefined;
}

/** Infer Maklerprovision from listing text and optionally the portal URL. */
export function inferBrokerInvolved(text: string, url?: string): boolean | undefined {
  const blob = text.replace(/\s+/g, " ").toLowerCase();

  const noBroker = [
    /provisionsfrei/i,
    /ohne\s+(?:makler|provision)/i,
    /keine\s+provision/i,
    /kein(?:er|e|en)?\s+makler/i,
    /von\s+privat/i,
    /privatverkauf/i,
    /privat\s+angebot/i,
    /eigennutzerangebot/i,
    /direct\s+von\s+privat/i,
  ];
  if (noBroker.some((re) => re.test(blob))) return false;

  const yesBroker = [
    /provisionspflichtig/i,
    /maklerprovision/i,
    /maklercourtage/i,
    /courtage\s+des\s+maklers/i,
    /mit\s+(?:immobilien)?makler/i,
    /käuferprovision/i,
    /provision\s*:\s*[1-9]/i,
    /provision\s+ist\s+fällig/i,
    /immobilienmakler/i,
  ];
  if (yesBroker.some((re) => re.test(blob))) return true;

  if (url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (
        host.includes("immobilienscout24.") ||
        host.includes("immowelt.") ||
        host.includes("immonet.") ||
        host.includes("immobilien.de") ||
        host.includes("landingpage.immobilien")
      ) {
        return true;
      }
    } catch {
      // ignore invalid URL
    }
  }

  return undefined;
}

const LISTING_DESCRIPTION_MAX = 8_000;

/** Use highlights as description when no dedicated description was parsed. */
export function finalizeListingPreviewFields(
  fields: ListingPreviewFields,
  highlights?: string
): ListingPreviewFields {
  const out = { ...fields };
  if (!out.description?.trim() && highlights?.trim()) {
    out.description = highlights.trim().slice(0, LISTING_DESCRIPTION_MAX);
  }
  if (out.description) {
    out.description = out.description.slice(0, LISTING_DESCRIPTION_MAX);
  }
  return out;
}

export type ListingPreviewResult =
  | { ok: true; fields: ListingPreviewFields; warnings: string[]; highlights?: string; llmUsed?: boolean }
  | { ok: false; error: string; warnings: string[] };

function parseGermanPrice(raw: string): number | undefined {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const value = parseInt(digits, 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseEnergyClass(text: string): string | undefined {
  const match = text.match(/\b([A-H][+]?)\b/i);
  if (!match) return undefined;
  return match[1].toUpperCase().replace("++", "+");
}

export function parseEnergyClassInput(raw: string): string | null {
  const value = parseEnergyClass(raw.trim());
  return value ?? null;
}

export function parseSqmFromText(text: string): number | undefined {
  const living = parseLivingSqmFromText(text);
  if (living != null) return living;
  const sqmMatch = text.match(/(\d{1,3}(?:[.,]\d+)?)\s*m[²2]/i);
  if (!sqmMatch) return undefined;
  const before = text.slice(Math.max(0, sqmMatch.index! - 40), sqmMatch.index!).toLowerCase();
  if (/grundst[üu]ck/.test(before)) return undefined;
  const n = parseFloat(sqmMatch[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

export function parseLivingSqmFromText(text: string): number | undefined {
  const patterns = [
    /wohnfl[äa]che[:\s]*(\d{1,3}(?:[.,]\d+)?)\s*m[²2]?/i,
    /nutzfl[äa]che[:\s]*(\d{1,3}(?:[.,]\d+)?)\s*m[²2]?/i,
    /wohnungsgr[öo][ßs]e[:\s]*(\d{1,3}(?:[.,]\d+)?)\s*m[²2]?/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const n = parseFloat(m[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return undefined;
}

export function parsePlotSqmFromText(text: string): number | undefined {
  const patterns = [
    /grundst[üu]cks?(?:s)?fl[äa]che[:\s]*(\d{1,4}(?:[.,]\d+)?)\s*m[²2]?/i,
    /grundst[üu]ck[:\s]*(\d{1,4}(?:[.,]\d+)?)\s*m[²2]?/i,
    /grundst[üu]ck[^0-9]{0,24}?(\d{1,4}(?:[.,]\d+)?)\s*m[²2]?/i,
    /(\d{1,4}(?:[.,]\d+)?)\s*m[²2]\s*grundst[üu]ck/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const n = parseFloat(m[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return undefined;
}

function extractJsonLdObjects(html: string): unknown[] {
  const objects: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim()) as unknown;
      if (Array.isArray(parsed)) objects.push(...parsed);
      else objects.push(parsed);
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }
  return objects;
}

function collectFromJsonLd(objects: unknown[], fields: ListingPreviewFields): void {
  for (const obj of objects) {
    if (!obj || typeof obj !== "object") continue;
    const record = obj as Record<string, unknown>;
    const type = String(record["@type"] ?? "");
    const types = Array.isArray(record["@type"])
      ? record["@type"].map(String)
      : [type];
    const isListing = types.some((t) =>
      /residence|apartment|house|product|realestate/i.test(t)
    );
    if (!isListing && !record.offers) continue;

    if (!fields.title && typeof record.name === "string") fields.title = record.name;
    if (!fields.address) {
      const addr = record.address;
      if (typeof addr === "string") fields.address = addr;
      else if (addr && typeof addr === "object") {
        const a = addr as Record<string, unknown>;
        const parts = [a.streetAddress, a.postalCode, a.addressLocality].filter(Boolean);
        if (parts.length) fields.address = parts.join(", ");
      }
    }
    const offers = record.offers;
    if (offers && typeof offers === "object" && !fields.price) {
      const price = (offers as Record<string, unknown>).price;
      if (typeof price === "number") fields.price = Math.round(price);
      else if (typeof price === "string") fields.price = parseGermanPrice(price);
    }
    if (typeof record.floorSize === "number" && !fields.sizeSqm) {
      fields.sizeSqm = Math.round(record.floorSize);
    }
  }
}

function metaContent(html: string, property: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(re);
  return m?.[1]?.trim();
}

/** Heuristic field extraction from plain text (Exposé PDF, scraped page text). */
export function parseListingPlainText(text: string): ListingPreviewFields {
  const fields: ListingPreviewFields = {};
  const textBlob = text.replace(/\s+/g, " ").trim();

  if (!fields.price) {
    const priceMatch = textBlob.match(/(\d{1,3}(?:\.\d{3})*|\d+)\s*(?:€|EUR|Euro)/i);
    if (priceMatch) fields.price = parseGermanPrice(priceMatch[1]);
  }
  if (!fields.price) {
    const kaufpreisMatch = textBlob.match(
      /kaufpreis[:\s]*(\d{1,3}(?:\.\d{3})*|\d+)/i
    );
    if (kaufpreisMatch) fields.price = parseGermanPrice(kaufpreisMatch[1]);
  }

  if (!fields.plotSizeSqm) {
    const plot = parsePlotSqmFromText(textBlob);
    if (plot != null) fields.plotSizeSqm = plot;
  }

  if (!fields.sizeSqm) {
    const parsed = parseLivingSqmFromText(textBlob) ?? parseSqmFromText(textBlob);
    if (parsed != null) fields.sizeSqm = parsed;
  }

  if (!fields.energyClass) {
    const energyMatch = textBlob.match(
      /energie\s*(?:effizienz)?\s*klasse\s*([A-H][+]?)/i
    );
    const energyLooseMatch = textBlob.match(
      /energie\s*(?:effizienz)?\s*klasse[^A-H]{0,40}?([A-H][+]?)\b/i
    );
    fields.energyClass = energyMatch
      ? parseEnergyClass(energyMatch[1])
      : energyLooseMatch
        ? parseEnergyClass(energyLooseMatch[1])
        : parseEnergyClass(textBlob);
  }

  if (!fields.address) {
    const plzStreet = textBlob.match(
      /([A-ZÄÖÜ][a-zäöüß.\-]+(?:straße|str\.|weg|platz|allee|gasse)[^,]{0,80},\s*\d{5}\s+[A-ZÄÖÜ][a-zäöüß\-]+)/i
    );
    if (plzStreet && !isBrokerOfficeAddress(plzStreet[1])) {
      fields.address = plzStreet[1].trim().slice(0, 200);
    }
  }

  if (fields.address) fields.address = fields.address.slice(0, 300);

  const broker = inferBrokerInvolved(textBlob);
  if (broker != null) fields.brokerInvolved = broker;

  if (!fields.hoaFeeMonthly) {
    fields.hoaFeeMonthly = parseEuroAmountFromLabel(textBlob, [
      /hausgeld[:\s]*(\d{1,3}(?:\.\d{3})*|\d+)\s*(?:€|EUR)?/i,
      /(?:monatliches?\s+)?hausgeld[:\s]*(\d{1,3}(?:\.\d{3})*|\d+)/i,
    ]);
  }
  if (!fields.heatingCostMonthly) {
    fields.heatingCostMonthly = parseEuroAmountFromLabel(textBlob, [
      /heizkosten[:\s]*(\d{1,3}(?:\.\d{3})*|\d+)\s*(?:€|EUR)?/i,
    ]);
  }
  if (!fields.propertyTaxAnnual) {
    fields.propertyTaxAnnual = parseEuroAmountFromLabel(textBlob, [
      /grundsteuer[:\s]*(\d{1,3}(?:\.\d{3})*|\d+)\s*(?:€|EUR)?\s*(?:\/|pro)?\s*Jahr/i,
      /grundsteuer[:\s]*(\d{1,3}(?:\.\d{3})*|\d+)/i,
    ]);
  }
  if (!fields.renovationCost) {
    fields.renovationCost = parseEuroAmountFromLabel(textBlob, [
      /sanierungs?(?:kosten|bedarf)?[:\s]*(\d{1,3}(?:\.\d{3})*|\d+)/i,
      /renovierungs?(?:kosten)?[:\s]*(\d{1,3}(?:\.\d{3})*|\d+)/i,
    ]);
  }

  return fields;
}

export function parseListingHtml(html: string, url?: string): ListingPreviewFields {
  const fields: ListingPreviewFields = {};
  const jsonLdObjects = extractJsonLdObjects(html);
  collectFromJsonLd(jsonLdObjects, fields);
  const relaxedJsonLdAddress = extractRelaxedJsonLdPropertyAddress(html);

  fields.title =
    extractRelaxedJsonLdListingName(html) ??
    metaContent(html, "og:title") ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  for (const obj of jsonLdObjects) {
    if (fields.title) break;
    if (obj && typeof obj === "object" && typeof (obj as Record<string, unknown>).name === "string") {
      const name = String((obj as Record<string, unknown>).name).trim();
      if (name.length > 12 && /wohnung|haus|reihen|immobil|vorankündigung/i.test(name)) {
        fields.title = name;
        break;
      }
    }
  }

  const ogDesc = metaContent(html, "og:description") ?? "";
  if (ogDesc) fields.description = ogDesc.slice(0, LISTING_DESCRIPTION_MAX);
  const textBlob = `${ogDesc} ${html.replace(/<[^>]+>/g, " ")}`;
  const fromText = parseListingPlainText(textBlob);

  if (!fields.price && fromText.price != null) fields.price = fromText.price;
  if (!fields.sizeSqm && fromText.sizeSqm != null) fields.sizeSqm = fromText.sizeSqm;
  if (!fields.energyClass && fromText.energyClass) fields.energyClass = fromText.energyClass;

  const pickedAddress = pickPropertyListingAddress({
    title: fields.title,
    textBlob,
    jsonLdAddress: fields.address,
    relaxedJsonLdAddress,
    heuristicStreet: fromText.address,
  });
  if (pickedAddress) fields.address = pickedAddress;

  if (fields.title) fields.title = fields.title.slice(0, 200);

  if (fields.brokerInvolved == null) {
    const broker = inferBrokerInvolved(textBlob, url);
    if (broker != null) fields.brokerInvolved = broker;
  }

  return fields;
}

export type ListingPriceFetchResult =
  | { ok: true; price: number }
  | { ok: false; error: string };

export async function fetchListingPriceFromUrl(
  rawUrl: string,
  options?: { background?: boolean }
): Promise<ListingPriceFetchResult> {
  const url = normalizeListingUrl(rawUrl);
  if (!url) {
    return { ok: false, error: "invalid_url" };
  }

  const res = await fetchExternal(
    "listing",
    url,
    {
      headers: {
        "User-Agent": "PickHome/1.0 (listing price sync; self-hosted)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15_000),
    },
    options?.background ? { background: true } : undefined
  );

  if (!res?.ok) {
    return { ok: false, error: "fetch_failed" };
  }

  const html = await res.text();
  if (html.length < 200) {
    return { ok: false, error: "empty_response" };
  }

  const fields = parseListingHtml(html);
  if (fields.price == null || fields.price <= 0) {
    return { ok: false, error: "price_not_found" };
  }

  return { ok: true, price: fields.price };
}

export async function fetchListingPreview(rawUrl: string): Promise<ListingPreviewResult> {
  const url = normalizeListingUrl(rawUrl);
  if (!url) {
    return { ok: false, error: "invalid_url", warnings: [] };
  }

  const warnings: string[] = [];
  const res = await fetchExternal("listing", url, {
    headers: {
      "User-Agent": "PickHome/1.0 (listing preview; self-hosted)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res?.ok) {
    return {
      ok: false,
      error: "fetch_failed",
      warnings: ["Seite nicht lesbar — Felder manuell ausfüllen."],
    };
  }

  const html = await res.text();
  if (html.length < 200) {
    return {
      ok: false,
      error: "empty_response",
      warnings: ["Leere Antwort vom Portal."],
    };
  }

  let fields = parseListingHtml(html, url);
  let highlights: string | undefined;
  let llmUsed = false;

  if (await isLlmConfigured()) {
    const enriched = await enrichListingFieldsWithLlm(fields, htmlToListingSourceText(html));
    fields = enriched.fields;
    highlights = enriched.highlights;
    llmUsed = enriched.llmUsed;
    if (llmUsed) {
      warnings.push("Felder per KI ergänzt — bitte prüfen.");
    }
  }

  const hasAny =
    fields.title || fields.price || fields.sizeSqm || fields.address || fields.energyClass;

  if (!hasAny) {
    warnings.push("Keine Felder erkannt — bitte manuell ausfüllen.");
  }

  if (
    !hasAny &&
    /captcha|zugriff verweigert|access denied/i.test(html)
  ) {
    warnings.push("Portal blockiert möglicherweise automatischen Abruf.");
  }

  return {
    ok: true,
    fields: finalizeListingPreviewFields(fields, highlights),
    warnings,
    highlights,
    llmUsed,
  };
}
