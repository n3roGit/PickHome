import { describe, expect, it } from "vitest";
import {
  computeBorisLandValueEur,
  parseBorisIdentifyResults,
  primaryBorisResult,
  sortBorisResults,
  type BorisResult,
} from "@/lib/boris";

describe("boris", () => {
  it("maps identify hits to labeled results and filters availability layer", () => {
    const results = parseBorisIdentifyResults([
      {
        layerName: "brw_verfuegbarkeit",
        attributes: { Bodenrichtwert: "999" },
      },
      {
        layerName: "brw_wohnbauflaeche",
        attributes: {
          Bodenrichtwert: "790",
          BodenrichtwertNummer: "10003431",
          BodenrichtwertzoneName: "Zone 10003431",
          Nutzungsart: "1100",
          ErgänzungNutzung: "1002",
          Gemeindename: "Bremen",
          Gemarkungsnummer: "04040001",
          Stichtag: "2023-01-01",
          Entwicklungszustand: "1000",
          beitragsrechtlicherZustand: "1000",
        },
      },
      {
        layerName: "brw_gemischte_bauweise",
        attributes: {
          Bodenrichtwert: "1300",
          BodenrichtwertNummer: "10003433",
          Nutzungsart: "1230",
          Stichtag: "2023-01-01",
        },
      },
      {
        layerName: "brw_wohnbauflaeche",
        attributes: {
          Bodenrichtwert: "0",
        },
      },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      kategorie: "brw_wohnbauflaeche",
      kategorieLabel: "Wohnbaufläche",
      brwEurPerSqm: 790,
      nutzungsartLabel: "Wohnbaufläche (W)",
      erganzungLabel: "Mehrfamilienhäuser (MFH)",
      zoneNumber: "10003431",
      gemeinde: "Bremen",
      entwicklungszustand: "Baureifes Land (B)",
      beitragsrecht: "Beitragsfrei (frei)",
    });
    expect(results[1].kategorie).toBe("brw_gemischte_bauweise");
    expect(results[1].nutzungsartLabel).toBe("Mischgebiet (MI)");
  });

  it("computes land value from brw and plot size", () => {
    expect(computeBorisLandValueEur(790, 450)).toBe(355_500);
    expect(computeBorisLandValueEur(0, 450)).toBeNull();
    expect(computeBorisLandValueEur(790, 0)).toBeNull();
  });

  it("picks the primary result by layer priority", () => {
    const mixed: BorisResult = {
      kategorie: "brw_gemischte_bauweise",
      kategorieLabel: "Gemischte Baufläche",
      brwEurPerSqm: 1300,
      nutzungsart: "1230",
      nutzungsartLabel: null,
      erganzungNutzung: null,
      erganzungLabel: null,
      zoneNumber: "1",
      zoneName: null,
      gemeinde: null,
      gemarkung: null,
      stichtag: null,
      entwicklungszustand: null,
      beitragsrecht: null,
    };
    const residential: BorisResult = {
      ...mixed,
      kategorie: "brw_wohnbauflaeche",
      kategorieLabel: "Wohnbaufläche",
      brwEurPerSqm: 790,
      zoneNumber: "2",
    };

    expect(primaryBorisResult([mixed, residential])?.kategorie).toBe("brw_wohnbauflaeche");
    expect(primaryBorisResult([])).toBeNull();
  });

  it("sorts results by layer priority", () => {
    const mixed: BorisResult = {
      kategorie: "brw_gemischte_bauweise",
      kategorieLabel: "Gemischte Baufläche",
      brwEurPerSqm: 1300,
      nutzungsart: "1230",
      nutzungsartLabel: null,
      erganzungNutzung: null,
      erganzungLabel: null,
      zoneNumber: "1",
      zoneName: null,
      gemeinde: null,
      gemarkung: null,
      stichtag: null,
      entwicklungszustand: null,
      beitragsrecht: null,
    };
    const residential: BorisResult = {
      ...mixed,
      kategorie: "brw_wohnbauflaeche",
      kategorieLabel: "Wohnbaufläche",
      brwEurPerSqm: 790,
      zoneNumber: "2",
    };

    expect(sortBorisResults([mixed, residential]).map((r) => r.kategorie)).toEqual([
      "brw_wohnbauflaeche",
      "brw_gemischte_bauweise",
    ]);
  });
});
