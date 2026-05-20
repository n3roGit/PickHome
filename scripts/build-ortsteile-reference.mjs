/**
 * Builds src/data/ortsteile-de.json from OpenPLZ API (OpenStreetMap, ODbL).
 * Aggregates suburb/borough names per PLZ. Run occasionally: npm run build:ortsteile-reference
 *
 * Requires network. Expect ~30–60 min for all PLZ (cached/resumable via .ortsteile-build-cache.json).
 */

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";

const API_BASE = "https://openplzapi.org/de/Streets";
const PAGE_SIZE = 50;
const DELAY_MS = 80;
const CONCURRENCY = 4;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function districtNamesFromRow(row) {
  const names = [];
  const suburb = String(row.suburb ?? "").trim();
  const borough = String(row.borough ?? "").trim();
  if (suburb) names.push(suburb);
  if (borough && borough !== suburb) names.push(borough);
  return names;
}

async function fetchPlzPage(plz, page) {
  const url = `${API_BASE}?postalCode=${encodeURIComponent(plz)}&page=${page}&pageSize=${PAGE_SIZE}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`OpenPLZ ${plz} page ${page}: HTTP ${res.status}`);
  }
  const rows = await res.json();
  const totalPages = Number(res.headers.get("x-total-pages") ?? "1");
  return { rows, totalPages };
}

async function fetchDistrictsForPlz(plz) {
  const districts = new Set();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const { rows, totalPages: tp } = await fetchPlzPage(plz, page);
    totalPages = tp;
    for (const row of rows) {
      for (const name of districtNamesFromRow(row)) {
        districts.add(name);
      }
    }
    page += 1;
    await sleep(DELAY_MS);
  }

  return [...districts].sort((a, b) => a.localeCompare(b, "de"));
}

async function loadPlzList(quick) {
  const plzPath = join(process.cwd(), "src", "data", "plz-de.json");
  const raw = JSON.parse(await readFile(plzPath, "utf8"));
  const plz = raw.plz.map((e) => e.plz);
  if (quick) {
    return plz.filter((p) => p.startsWith("28") || p.startsWith("10") || p.startsWith("80"));
  }
  return plz;
}

async function loadCache(cachePath) {
  try {
    await access(cachePath);
    return JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  const quick = process.argv.includes("--quick");
  const plzList = await loadPlzList(quick);
  const outDir = join(process.cwd(), "src", "data");
  const cachePath = join(outDir, ".ortsteile-build-cache.json");
  const byPlz = await loadCache(cachePath);

  console.log(
    `[pickhome] Building ortsteile reference for ${plzList.length} PLZ${quick ? " (quick)" : ""}…`
  );

  let done = 0;
  let idx = 0;

  async function worker() {
    while (idx < plzList.length) {
      const plz = plzList[idx++];
      if (byPlz[plz]) {
        done += 1;
        continue;
      }
      try {
        const districts = await fetchDistrictsForPlz(plz);
        if (districts.length > 0) {
          byPlz[plz] = districts;
        }
      } catch (err) {
        console.warn(`[pickhome] Skip ${plz}:`, err.message);
      }
      done += 1;
      if (done % 25 === 0) {
        await writeFile(cachePath, JSON.stringify(byPlz));
        console.log(`[pickhome] Progress ${done}/${plzList.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  await writeFile(cachePath, JSON.stringify(byPlz));

  const entries = Object.entries(byPlz)
    .map(([plz, districts]) => ({ plz, districts }))
    .sort((a, b) => a.plz.localeCompare(b.plz));

  const output = {
    source: "OpenPLZ API / OpenStreetMap (ODbL 1.0)",
    generatedAt: new Date().toISOString().slice(0, 10),
    plzWithDistricts: entries.length,
    byPlz: Object.fromEntries(entries.map((e) => [e.plz, e.districts])),
  };

  const outPath = join(outDir, "ortsteile-de.json");
  await writeFile(outPath, JSON.stringify(output));

  const sizeKb = Math.round((JSON.stringify(output).length / 1024) * 10) / 10;
  console.log(`[pickhome] Wrote ${outPath} — ${entries.length} PLZ with districts (${sizeKb} KB)`);
}

main().catch((err) => {
  console.error("[pickhome] build-ortsteile-reference failed:", err);
  process.exit(1);
});
