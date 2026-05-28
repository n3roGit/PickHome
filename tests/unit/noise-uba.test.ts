import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildNoiseHumanSummary,
  fetchNoiseIdentifyHits,
  fetchNoiseUbaForCoords,
  highestNoiseBandDb,
  noiseHitsForCriterionName,
  parseNoiseIdentifyResults,
  parseUbaNoiseCode,
  UBA_NOISE_IDENTIFY_LAYER_IDS,
} from "@/lib/noise-uba";
import { fetchArcGisIdentify } from "@/lib/arcgis-identify";
import { resetExternalFetchState } from "@/lib/external-fetch";

vi.mock("@/lib/arcgis-identify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/arcgis-identify")>();
  return {
    ...actual,
    fetchArcGisIdentify: vi.fn(),
  };
});

describe("noise-uba", () => {
  beforeEach(() => {
    vi.mocked(fetchArcGisIdentify).mockReset();
    resetExternalFetchState();
  });

  it("parses UBA noise codes", () => {
    expect(parseUbaNoiseCode("Lden6064")).toEqual({ metric: "Lden", bandDb: "60-64" });
    expect(parseUbaNoiseCode("Lnight5054")).toEqual({ metric: "Lnight", bandDb: "50-54" });
    expect(parseUbaNoiseCode("Lden75")).toEqual({ metric: "Lden", bandDb: ">75" });
  });

  it("parses Berlin-style identify hits and dedupes by source", () => {
    const hits = parseNoiseIdentifyResults([
      {
        layerName: "LK_BLR_Abfrage",
        attributes: {
          road_den: "Lden6064",
          road_night: "Lnight5054",
          rail_den: "",
          rail_night: "",
        },
      },
      {
        layerName: "LK_HLQ_road_Den",
        attributes: { Lärmpegelklasse: "Lden5559" },
      },
      {
        layerName: "Bundeslaender_BZ",
        attributes: { Lden6064: "58800" },
      },
    ]);

    expect(hits.some((h) => h.source === "Straße" && h.metric === "Lden" && h.bandDb === "60-64")).toBe(
      true
    );
    expect(hits.some((h) => h.source === "Straße" && h.metric === "Lnight")).toBe(true);
    expect(hits.every((h) => !h.bandDb.includes("LK_"))).toBe(true);
    expect(highestNoiseBandDb(hits)).toBe(60);
  });

  it("builds human-readable summary", () => {
    const hits = parseNoiseIdentifyResults([
      {
        layerName: "LK_BLR_Abfrage",
        attributes: { road_den: "Lden6064", road_night: "Lnight5054" },
      },
    ]);
    const summary = buildNoiseHumanSummary(hits);
    expect(summary.headline).toMatch(/UBA-Lärmkarte/);
    expect(summary.sources[0]?.sourceLabel).toBe("Straßenverkehr");
    expect(summary.sources[0]?.lines[0]?.bandHuman).toContain("60");
  });

  it("maps hits to criterion names", () => {
    const hits = parseNoiseIdentifyResults([
      {
        layerName: "LK_BLR_Abfrage",
        attributes: { air_den: "Lden6064" },
      },
    ]);
    expect(noiseHitsForCriterionName(hits, "Fluglärm")).toHaveLength(1);
    expect(noiseHitsForCriterionName(hits, "Zuglärm")).toHaveLength(0);
  });

  it("queries fast UBA layers individually instead of layers=all", async () => {
    vi.mocked(fetchArcGisIdentify)
      .mockResolvedValueOnce({
        ok: true,
        results: [
          {
            layerName: "LK_BLR_Abfrage",
            attributes: { road_den: "Lden6064", road_night: "Lnight5054" },
          },
        ],
      })
      .mockResolvedValue({ ok: true, results: [] });

    const result = await fetchNoiseIdentifyHits(53.1144256, 8.8966571);

    expect(result.ok).toBe(true);
    expect(fetchArcGisIdentify).toHaveBeenCalledTimes(UBA_NOISE_IDENTIFY_LAYER_IDS.length);
    expect(fetchArcGisIdentify).toHaveBeenCalledWith(
      expect.objectContaining({ layers: "visible:1000" })
    );
    expect(fetchArcGisIdentify).toHaveBeenCalledWith(
      expect.objectContaining({ layers: "visible:4220" })
    );
  });

  it("returns partial noise data when some layer requests fail", async () => {
    vi.mocked(fetchArcGisIdentify)
      .mockResolvedValueOnce({ ok: false, error: "fetch_failed" })
      .mockResolvedValueOnce({
        ok: true,
        results: [
          {
            layerName: "LK_BLR_road_Night",
            attributes: { Lärmpegelklasse: "Lnight5559" },
          },
        ],
      })
      .mockResolvedValue({ ok: false, error: "fetch_failed" });

    const result = await fetchNoiseUbaForCoords(53.1144256, 8.8966571);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.hits.some((h) => h.metric === "Lnight")).toBe(true);
    }
  });
});
