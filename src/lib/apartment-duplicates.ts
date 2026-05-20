export type DuplicateMatch = {
  otherId: string;
  otherTitle: string;
  reason: "address" | "title";
};

export type ApartmentDuplicateInput = {
  id: string;
  title: string;
  address: string | null;
};

const UMLAUT_MAP: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
};

export function normalizeAddressKey(address: string | null | undefined): string | null {
  if (!address?.trim()) return null;
  let s = address.trim().toLowerCase();
  for (const [from, to] of Object.entries(UMLAUT_MAP)) {
    s = s.replaceAll(from, to);
  }
  s = s.replace(/str\.?asse/g, "str");
  s = s.replace(/str\./g, "str");
  s = s.replace(/[^a-z0-9]+/g, " ").trim();
  return s.length >= 8 ? s : null;
}

function normalizeTitleKey(title: string): string {
  let s = title.trim().toLowerCase();
  for (const [from, to] of Object.entries(UMLAUT_MAP)) {
    s = s.replaceAll(from, to);
  }
  return s.replace(/[^a-z0-9]+/g, " ").trim();
}

function titleSimilarity(a: string, b: string): number {
  const ta = normalizeTitleKey(a);
  const tb = normalizeTitleKey(b);
  if (!ta || !tb) return 0;
  if (ta === tb) return 1;
  const tokensA = new Set(ta.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(tb.split(" ").filter((t) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

const TITLE_SIMILARITY_THRESHOLD = 0.85;

export function findDuplicatesForApartment(
  apartment: ApartmentDuplicateInput,
  others: ApartmentDuplicateInput[]
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const addressKey = normalizeAddressKey(apartment.address);

  for (const other of others) {
    if (other.id === apartment.id) continue;

    if (addressKey) {
      const otherKey = normalizeAddressKey(other.address);
      if (otherKey && otherKey === addressKey) {
        matches.push({
          otherId: other.id,
          otherTitle: other.title,
          reason: "address",
        });
        continue;
      }
    }

    if (titleSimilarity(apartment.title, other.title) >= TITLE_SIMILARITY_THRESHOLD) {
      matches.push({
        otherId: other.id,
        otherTitle: other.title,
        reason: "title",
      });
    }
  }

  return matches;
}

export function buildDuplicateIndex(
  apartments: ApartmentDuplicateInput[]
): Map<string, DuplicateMatch[]> {
  const index = new Map<string, DuplicateMatch[]>();
  for (const apt of apartments) {
    const matches = findDuplicatesForApartment(
      apt,
      apartments.filter((o) => o.id !== apt.id)
    );
    if (matches.length > 0) {
      index.set(apt.id, matches);
    }
  }
  return index;
}
