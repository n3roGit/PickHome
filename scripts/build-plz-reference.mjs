/**
 * Downloads German PLZ ↔ Ort ↔ Bundesland data (ODbL, suche-postleitzahl.org / OSM)
 * and writes src/data/plz-de.json for offline use in PickHome.
 *
 * Re-run occasionally to refresh: npm run build:plz-reference
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SOURCE_URL =
  "https://raw.githubusercontent.com/plzTeam/web-snippets/master/plz-suche/data/zuordnung_plz_ort.csv";
const GEOCOORD_URL =
  "https://raw.githubusercontent.com/WZBSocialScienceCenter/plz_geocoord/master/plz_geocoord.csv";

function parseCsvLine(line) {
  const parts = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts;
}

function ortKey(name, bundesland) {
  return `${name.trim()}|${bundesland.trim()}`;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  return res.text();
}

async function loadPlzGeocoords() {
  console.log("[pickhome] Fetching PLZ geocoordinates...");
  const text = await fetchText(GEOCOORD_URL);
  const lines = text.split(/\r?\n/).filter(Boolean);
  /** @type {Map<string, { lat: number, lng: number }>} */
  const coords = new Map();

  for (const line of lines.slice(1)) {
    const [plzRaw, latRaw, lngRaw] = line.split(",");
    const plz = plzRaw?.replace(/\D/g, "");
    const lat = Number.parseFloat(latRaw ?? "");
    const lng = Number.parseFloat(lngRaw ?? "");
    if (!/^\d{5}$/.test(plz ?? "") || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    coords.set(plz, { lat, lng });
  }

  return coords;
}

async function main() {
  console.log("[pickhome] Fetching PLZ reference data...");
  const [text, geocoords] = await Promise.all([fetchText(SOURCE_URL), loadPlzGeocoords()]);
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const plzIdx = header.indexOf("plz");
  const ortIdx = header.indexOf("ort");
  const stateIdx = header.indexOf("bundesland");
  if (plzIdx < 0 || ortIdx < 0 || stateIdx < 0) {
    throw new Error(`Unexpected CSV header: ${lines[0]}`);
  }

  /** @type {Map<string, { name: string, bundesland: string, plz: Set<string> }>} */
  const orte = new Map();
  /** @type {Map<string, { orte: Set<string>, bundesland: string }>} */
  const plzIndex = new Map();

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const plz = cols[plzIdx]?.replace(/\D/g, "");
    const ort = cols[ortIdx]?.trim();
    const bundesland = cols[stateIdx]?.trim();
    if (!/^\d{5}$/.test(plz) || !ort || !bundesland) continue;

    const key = ortKey(ort, bundesland);
    if (!orte.has(key)) {
      orte.set(key, { name: ort, bundesland, plz: new Set() });
    }
    orte.get(key).plz.add(plz);

    if (!plzIndex.has(plz)) {
      plzIndex.set(plz, { orte: new Set(), bundesland });
    }
    const entry = plzIndex.get(plz);
    entry.orte.add(ort);
    if (entry.bundesland !== bundesland) {
      entry.bundesland = bundesland;
    }
  }

  const orteList = [...orte.values()]
    .map((o) => ({
      name: o.name,
      bundesland: o.bundesland,
      plz: [...o.plz].sort(),
    }))
    .sort((a, b) => {
      const byState = a.bundesland.localeCompare(b.bundesland, "de");
      if (byState !== 0) return byState;
      return a.name.localeCompare(b.name, "de");
    });

  const plzEntries = [...plzIndex.entries()]
    .map(([plz, data]) => {
      const centroid = geocoords.get(plz);
      return {
        plz,
        bundesland: data.bundesland,
        orte: [...data.orte].sort((a, b) => a.localeCompare(b, "de")),
        ...(centroid ? { lat: centroid.lat, lng: centroid.lng } : {}),
      };
    })
    .sort((a, b) => a.plz.localeCompare(b.plz));

  const plzWithCoords = plzEntries.filter((entry) => entry.lat != null && entry.lng != null).length;

  const bundeslaender = [...new Set(orteList.map((o) => o.bundesland))].sort((a, b) =>
    a.localeCompare(b, "de")
  );

  const output = {
    source:
      "suche-postleitzahl.org / OpenStreetMap (ODbL 1.0); PLZ centroids: WZB plz_geocoord (Apache-2.0)",
    generatedAt: new Date().toISOString().slice(0, 10),
    ortCount: orteList.length,
    plzCount: plzEntries.length,
    plzWithCoords,
    bundeslaender,
    orte: orteList,
    plz: plzEntries,
  };

  const outDir = join(process.cwd(), "src", "data");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "plz-de.json");
  await writeFile(outPath, JSON.stringify(output));

  const sizeKb = Math.round((JSON.stringify(output).length / 1024) * 10) / 10;
  console.log(
    `[pickhome] Wrote ${outPath} — ${output.plzCount} PLZ (${plzWithCoords} with coords), ${output.ortCount} Orte (${sizeKb} KB)`
  );
}

main().catch((err) => {
  console.error("[pickhome] build-plz-reference failed:", err);
  process.exit(1);
});
