import { fetchExternal } from "@/lib/external-fetch";
import { normalizeListingUrl } from "@/lib/listing-url";

export type ListingPreviewFields = {
  title?: string;
  price?: number;
  sizeSqm?: number;
  address?: string;
  energyClass?: string;
};

export type ListingPreviewResult =
  | { ok: true; fields: ListingPreviewFields; warnings: string[] }
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

export function parseListingHtml(html: string): ListingPreviewFields {
  const fields: ListingPreviewFields = {};
  collectFromJsonLd(extractJsonLdObjects(html), fields);

  if (!fields.title) {
    fields.title =
      metaContent(html, "og:title") ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  }

  const ogDesc = metaContent(html, "og:description") ?? "";
  const textBlob = `${ogDesc} ${html.replace(/<[^>]+>/g, " ")}`;

  if (!fields.price) {
    const priceMatch = textBlob.match(
      /(\d{1,3}(?:\.\d{3})*|\d+)\s*(?:€|EUR|Euro)/i
    );
    if (priceMatch) fields.price = parseGermanPrice(priceMatch[1]);
  }

  if (!fields.sizeSqm) {
    const sqmMatch = textBlob.match(/(\d{1,3}(?:[.,]\d+)?)\s*m[²2]/i);
    if (sqmMatch) {
      const n = parseFloat(sqmMatch[1].replace(",", "."));
      if (Number.isFinite(n)) fields.sizeSqm = Math.round(n);
    }
  }

  if (!fields.energyClass) {
    const energyMatch = textBlob.match(
      /energie\s*(?:effizienz)?\s*klasse\s*([A-H][+]?)/i
    );
    fields.energyClass = energyMatch
      ? parseEnergyClass(energyMatch[1])
      : parseEnergyClass(textBlob);
  }

  if (!fields.address) {
    const plzStreet = textBlob.match(
      /([A-ZÄÖÜ][a-zäöüß.\-]+(?:straße|str\.|weg|platz|allee|gasse)[^,]{0,80},\s*\d{5}\s+[A-ZÄÖÜ][a-zäöüß\-]+)/i
    );
    if (plzStreet) fields.address = plzStreet[1].trim().slice(0, 200);
  }

  if (fields.title) fields.title = fields.title.slice(0, 200);
  if (fields.address) fields.address = fields.address.slice(0, 300);

  return fields;
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

  const fields = parseListingHtml(html);
  const hasAny =
    fields.title || fields.price || fields.sizeSqm || fields.address || fields.energyClass;

  if (!hasAny) {
    warnings.push("Keine Felder erkannt — bitte manuell ausfüllen.");
  }

  if (/captcha|zugriff verweigert|access denied/i.test(html)) {
    warnings.push("Portal blockiert möglicherweise automatischen Abruf.");
  }

  return { ok: true, fields, warnings };
}
