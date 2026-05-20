import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearLocationAreasCache,
  loadLocationCities,
  parseLocationCityFile,
  selectedPlzCentroids,
} from "@/lib/location-areas";

describe("location-areas", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(() => {
    previousDataDir = process.env.PICKHOME_DATA_DIR;
    dataDir = mkdtempSync(join(tmpdir(), "pickhome-location-areas-"));
    process.env.PICKHOME_DATA_DIR = dataDir;
    clearLocationAreasCache();
  });

  afterEach(() => {
    clearLocationAreasCache();
    if (previousDataDir === undefined) {
      delete process.env.PICKHOME_DATA_DIR;
    } else {
      process.env.PICKHOME_DATA_DIR = previousDataDir;
    }
  });

  it("returns empty catalog when directory is missing", () => {
    expect(loadLocationCities()).toEqual([]);
  });

  it("loads cities from json files", () => {
    const areasDir = join(dataDir, "location-areas");
    mkdirSync(areasDir, { recursive: true });
    writeFileSync(
      join(areasDir, "alpha.json"),
      JSON.stringify({
        id: "alpha",
        name: "Alpha",
        postalCodes: [{ plz: "12345", districts: ["North"] }],
      })
    );
    writeFileSync(
      join(areasDir, "beta.json"),
      JSON.stringify({
        id: "beta",
        name: "Beta",
        postalCodes: [{ plz: "54321", districts: ["South"], centroid: { lat: 1, lng: 2 } }],
      })
    );
    clearLocationAreasCache();

    const catalog = loadLocationCities();
    expect(catalog.map((c) => c.id)).toEqual(["alpha", "beta"]);
    expect(selectedPlzCentroids(catalog[1], ["54321"])).toEqual([
      { plz: "54321", lat: 1, lng: 2 },
    ]);
  });

  it("ignores invalid json files", () => {
    const areasDir = join(dataDir, "location-areas");
    mkdirSync(areasDir, { recursive: true });
    writeFileSync(join(areasDir, "broken.json"), "{");
    writeFileSync(
      join(areasDir, "valid.json"),
      JSON.stringify({
        id: "valid",
        name: "Valid",
        postalCodes: [{ plz: "11111", districts: ["A"] }],
      })
    );
    clearLocationAreasCache();

    expect(loadLocationCities()).toHaveLength(1);
    expect(loadLocationCities()[0].id).toBe("valid");
  });

  it("parses city files with optional centroid", () => {
    const city = parseLocationCityFile(
      JSON.stringify({
        id: "x",
        name: "X",
        postalCodes: [
          { plz: "99999", districts: ["D1", "D2"], centroid: { lat: 53.1, lng: 8.8 } },
        ],
      }),
      "x.json"
    );
    expect(city?.postalCodes[0].centroid).toEqual({ lat: 53.1, lng: 8.8 });
  });
});
