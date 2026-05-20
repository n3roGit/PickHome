import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetExternalFetchState } from "@/lib/external-fetch";
import { fetchTransitJourney, motisLegsToTransitJourneyLegs } from "@/lib/transit-routing";
import { resolveTransitSettings } from "@/lib/transit-settings";

const testTransitSettings = resolveTransitSettings({
  transitArrivalHour: null,
  transitArrivalMinute: null,
  transitArrivalWeekday: null,
  transitFallbackMaxKm: null,
  transitFallbackMode: null,
});

const sampleJourney = {
  journeys: [
    {
      legs: [
        {
          walking: true,
          origin: { name: "Start" },
          destination: { name: "Hbf" },
          plannedDeparture: "2026-05-21T07:00:00+02:00",
          plannedArrival: "2026-05-21T07:10:00+02:00",
          distance: 500,
        },
        {
          walking: false,
          line: { name: "RE 1" },
          origin: { name: "Hbf" },
          destination: { name: "Ziel" },
          plannedDeparture: "2026-05-21T07:12:00+02:00",
          plannedArrival: "2026-05-21T07:45:00+02:00",
        },
      ],
    },
  ],
};

const sampleMotisPlan = {
  itineraries: [
    {
      duration: 2700,
      legs: [
        {
          mode: "WALK",
          from: { name: "Start" },
          to: { name: "Hbf" },
          scheduledDeparture: "2026-05-21T07:00:00+02:00",
          scheduledArrival: "2026-05-21T07:10:00+02:00",
          distance: 500,
        },
        {
          mode: "BUS",
          from: { name: "Hbf", scheduledDeparture: "2026-05-21T07:12:00+02:00" },
          to: { name: "Ziel", scheduledArrival: "2026-05-21T07:45:00+02:00" },
          displayName: "RE 1",
        },
      ],
    },
  ],
};

describe("motisLegsToTransitJourneyLegs", () => {
  it("maps MOTIS legs to journey legs", () => {
    const legs = motisLegsToTransitJourneyLegs(sampleMotisPlan.itineraries[0].legs);
    expect(legs[0].walking).toBe(true);
    expect(legs[1].line?.name).toBe("RE 1");
  });
});

describe("fetchTransitJourney", () => {
  beforeEach(() => {
    resetExternalFetchState();
    vi.useFakeTimers();
    vi.stubEnv("TRANSIT_API_BASES", "");
    vi.stubEnv("TRANSIT_GTFS_API_BASE", "");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetExternalFetchState();
  });

  it("falls back to second provider when primary returns 503", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sampleJourney), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchTransitJourney({
      from: { latitude: 52.8, longitude: 8.75 },
      fromAddress: "Stuhr",
      to: { latitude: 53.1, longitude: 8.7 },
      toAddress: "Bremen",
      settings: testTransitSettings,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result?.connectionSummary).toBe("RE 1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("v6.db.transport.rest");
    expect(fetchMock.mock.calls[1][0]).toContain("v5.db.api.bahn.guru");
  });

  it("falls back to GTFS/MOTIS when REST providers fail", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sampleMotisPlan), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchTransitJourney({
      from: { latitude: 52.8, longitude: 8.75 },
      fromAddress: "Stuhr",
      to: { latitude: 53.1, longitude: 8.7 },
      toAddress: "Bremen",
      settings: testTransitSettings,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result?.connectionSummary).toBe("RE 1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain("api.transitous.org");
    expect(fetchMock.mock.calls[2][0]).toContain("/api/v5/plan");
  });

  it("does not activate background cooldown until all providers fail", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchTransitJourney(
      {
        from: { latitude: 52.8, longitude: 8.75 },
        fromAddress: "Stuhr",
        to: { latitude: 53.1, longitude: 8.7 },
        toAddress: "Bremen",
        settings: testTransitSettings,
      },
      { background: true }
    );
    await vi.runAllTimersAsync();
    expect(await promise).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
