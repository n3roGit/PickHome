import {
  fetchExternal,
  recordExternalServiceFailure,
  type FetchExternalOptions,
} from "@/lib/external-fetch";
import { formatRouteDistance, formatRouteDuration } from "@/lib/routing";
import { resolveTransitApiBases, resolveTransitGtfsApiBase } from "@/lib/transit-providers";
import {
  formatTransitArrivalForApi,
  nextTransitArrivalDate,
  type TransitSettings,
} from "@/lib/transit-settings";
import type { RoutePoint } from "@/lib/routing";

const PICKHOME_TRANSIT_USER_AGENT = "PickHome/1.0 (self-hosted)";

function isRetriableTransitStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

type MotisPlace = {
  name?: string;
  departure?: string;
  scheduledDeparture?: string;
  arrival?: string;
  scheduledArrival?: string;
  track?: string;
  scheduledTrack?: string;
};

type MotisPlanLeg = {
  mode?: string;
  from?: MotisPlace;
  to?: MotisPlace;
  distance?: number;
  displayName?: string;
  routeShortName?: string;
  headsign?: string;
};

type MotisPlanItinerary = {
  duration?: number;
  legs?: MotisPlanLeg[];
};

function motisLineName(leg: MotisPlanLeg): string | null {
  return (
    leg.displayName?.trim() ||
    leg.routeShortName?.trim() ||
    leg.headsign?.trim() ||
    null
  );
}

export function motisLegsToTransitJourneyLegs(legs: MotisPlanLeg[]): TransitJourneyLeg[] {
  return legs.map((leg) => {
    const walking = leg.mode === "WALK";
    const lineName = walking ? null : motisLineName(leg);
    return {
      walking,
      line: lineName ? { name: lineName } : null,
      origin: { name: leg.from?.name },
      destination: { name: leg.to?.name },
      departure: leg.from?.departure,
      plannedDeparture: leg.from?.scheduledDeparture ?? leg.from?.departure,
      arrival: leg.to?.arrival,
      plannedArrival: leg.to?.scheduledArrival ?? leg.to?.arrival,
      departurePlatform: leg.from?.scheduledTrack ?? leg.from?.track ?? null,
      arrivalPlatform: leg.to?.scheduledTrack ?? leg.to?.track ?? null,
      distance: walking ? leg.distance ?? undefined : undefined,
    };
  });
}

function buildTransitJourneyResult(
  legs: TransitJourneyLeg[],
  settings: TransitSettings,
  durationOverride?: number
): TransitJourneyResult | null {
  const durationSeconds =
    journeyDurationSeconds(legs) ??
    (durationOverride != null && durationOverride > 0 ? Math.round(durationOverride) : null);
  if (durationSeconds == null) return null;

  const legDetails = buildTransitLegDetails(legs);
  return {
    durationSeconds,
    distanceMeters: journeyDistanceMeters(legs),
    connectionSummary: formatConnectionSummary(legs),
    arrivalTargetLabel: buildArrivalTargetLabel(settings),
    legDetails,
    detailTooltip: formatTransitDetailTooltip(legDetails),
  };
}

async function parseMotisPlanResponse(
  res: Response,
  settings: TransitSettings
): Promise<TransitJourneyResult | null> {
  try {
    const data = (await res.json()) as {
      error?: string;
      itineraries?: MotisPlanItinerary[];
    };
    if (data.error) return null;

    const itinerary = data.itineraries?.[0];
    const rawLegs = itinerary?.legs;
    if (!itinerary || !rawLegs?.length) return null;

    return buildTransitJourneyResult(
      motisLegsToTransitJourneyLegs(rawLegs),
      settings,
      itinerary.duration
    );
  } catch {
    return null;
  }
}

async function fetchTransitJourneyMotis(
  input: {
    from: RoutePoint;
    to: RoutePoint;
    settings: TransitSettings;
  },
  options?: FetchExternalOptions
): Promise<TransitJourneyResult | null> {
  const base = resolveTransitGtfsApiBase();
  if (!base) return null;

  const arrivalDate = nextTransitArrivalDate(
    input.settings.arrivalWeekday,
    input.settings.arrivalHour,
    input.settings.arrivalMinute
  );
  const time = formatTransitArrivalForApi(arrivalDate);

  const params = new URLSearchParams({
    fromPlace: `${input.from.latitude},${input.from.longitude}`,
    toPlace: `${input.to.latitude},${input.to.longitude}`,
    time,
    arriveBy: "true",
    numItineraries: "1",
  });

  const url = `${base}/api/v5/plan?${params.toString()}`;
  const res = await fetchExternal(
    "transit",
    url,
    {
      headers: {
        "User-Agent": `${PICKHOME_TRANSIT_USER_AGENT}; https://github.com/n3roGit/PickHome`,
      },
      next: { revalidate: 3600 },
    },
    { ...options, maxAttempts: options?.maxAttempts ?? 0 }
  );

  if (res?.ok) {
    return parseMotisPlanResponse(res, input.settings);
  }

  if (res && !isRetriableTransitStatus(res.status)) {
    return null;
  }

  return null;
}

export type TransitJourneyLeg = {
  walking?: boolean;
  line?: { name?: string; mode?: string; product?: string } | null;
  origin?: { name?: string };
  destination?: { name?: string };
  departure?: string;
  plannedDeparture?: string;
  arrival?: string;
  plannedArrival?: string;
  departurePlatform?: string | null;
  plannedDeparturePlatform?: string | null;
  arrivalPlatform?: string | null;
  plannedArrivalPlatform?: string | null;
  distance?: number;
};

export type TransitLegDetail = {
  kind: "walk" | "transit";
  lineName: string | null;
  fromStop: string;
  toStop: string;
  departureTime: string | null;
  arrivalTime: string | null;
  departurePlatform: string | null;
  arrivalPlatform: string | null;
  distanceMeters: number | null;
};

export type TransitJourneyResult = {
  durationSeconds: number;
  distanceMeters: number;
  connectionSummary: string;
  arrivalTargetLabel: string;
  legDetails: TransitLegDetail[];
  detailTooltip: string;
};

function formatLegTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

function stopName(stop: { name?: string } | undefined, fallback: string): string {
  const name = stop?.name?.trim();
  return name || fallback;
}

export function formatTransitLegDetailLine(leg: TransitLegDetail, index: number): string {
  const prefix = `${index + 1}. `;
  if (leg.kind === "walk") {
    const dist =
      leg.distanceMeters != null && leg.distanceMeters > 0
        ? ` (${formatRouteDistance(leg.distanceMeters)})`
        : "";
    return `${prefix}Fußweg: ${leg.fromStop} → ${leg.toStop}${dist}`;
  }

  const line = leg.lineName ?? "ÖPNV";
  const depPlatform = leg.departurePlatform ? ` Gleis ${leg.departurePlatform}` : "";
  const arrPlatform = leg.arrivalPlatform ? ` Gleis ${leg.arrivalPlatform}` : "";
  const dep = leg.departureTime ?? "?";
  const arr = leg.arrivalTime ?? "?";
  return `${prefix}${line}: ${leg.fromStop}${depPlatform} ${dep} → ${leg.toStop}${arrPlatform} ${arr}`;
}

export function buildTransitLegDetails(legs: TransitJourneyLeg[]): TransitLegDetail[] {
  return legs.map((leg) => {
    if (leg.walking) {
      return {
        kind: "walk",
        lineName: null,
        fromStop: stopName(leg.origin, "Start"),
        toStop: stopName(leg.destination, "Ziel"),
        departureTime: formatLegTime(leg.departure ?? leg.plannedDeparture),
        arrivalTime: formatLegTime(leg.arrival ?? leg.plannedArrival),
        departurePlatform: null,
        arrivalPlatform: null,
        distanceMeters: leg.distance ?? null,
      };
    }

    return {
      kind: "transit",
      lineName: leg.line?.name?.trim() ?? null,
      fromStop: stopName(leg.origin, "Abfahrt"),
      toStop: stopName(leg.destination, "Ankunft"),
      departureTime: formatLegTime(leg.plannedDeparture ?? leg.departure),
      arrivalTime: formatLegTime(leg.plannedArrival ?? leg.arrival),
      departurePlatform: leg.plannedDeparturePlatform ?? leg.departurePlatform ?? null,
      arrivalPlatform: leg.plannedArrivalPlatform ?? leg.arrivalPlatform ?? null,
      distanceMeters: null,
    };
  });
}

export function formatTransitDetailTooltip(legDetails: TransitLegDetail[]): string {
  if (legDetails.length === 0) return "";
  return legDetails.map((leg, i) => formatTransitLegDetailLine(leg, i)).join("\n");
}

export function serializeTransitLegDetails(legDetails: TransitLegDetail[]): string {
  return JSON.stringify(legDetails);
}

export function parseTransitLegDetails(raw: string | null | undefined): TransitLegDetail[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as TransitLegDetail[];
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (leg) =>
        leg &&
        (leg.kind === "walk" || leg.kind === "transit") &&
        typeof leg.fromStop === "string" &&
        typeof leg.toStop === "string"
    );
  } catch {
    return null;
  }
}

export function formatConnectionSummary(legs: TransitJourneyLeg[]): string {
  const lines = legs
    .filter((leg) => !leg.walking && leg.line?.name)
    .map((leg) => leg.line!.name!.trim());
  if (lines.length === 0) return "ÖPNV";
  return lines.join(" → ");
}

export function journeyDurationSeconds(legs: TransitJourneyLeg[]): number | null {
  if (legs.length === 0) return null;
  const first = legs[0];
  const last = legs[legs.length - 1];
  const startRaw = first.departure ?? first.plannedDeparture;
  const endRaw = last.arrival ?? last.plannedArrival;
  if (!startRaw || !endRaw) return null;
  const start = new Date(startRaw).getTime();
  const end = new Date(endRaw).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 1000);
}

export function journeyDistanceMeters(legs: TransitJourneyLeg[]): number {
  return legs.reduce((sum, leg) => sum + (leg.distance ?? 0), 0);
}

export function buildArrivalTargetLabel(settings: TransitSettings): string {
  const { arrivalWeekday, arrivalHour, arrivalMinute } = settings;
  const weekdayNames = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const day = weekdayNames[arrivalWeekday] ?? "Mo";
  const time = `${String(arrivalHour).padStart(2, "0")}:${String(arrivalMinute).padStart(2, "0")}`;
  return `Ankunft ${day} ${time}`;
}

async function parseTransitJourneyResponse(
  res: Response,
  settings: TransitSettings
): Promise<TransitJourneyResult | null> {
  try {
    const data = (await res.json()) as {
      journeys?: { legs?: TransitJourneyLeg[] }[];
    };
    const legs = data.journeys?.[0]?.legs;
    if (!legs?.length) return null;
    return buildTransitJourneyResult(legs, settings);
  } catch {
    return null;
  }
}

export async function fetchTransitJourney(
  input: {
    from: RoutePoint;
    fromAddress: string;
    to: RoutePoint;
    toAddress: string;
    settings: TransitSettings;
  },
  options?: FetchExternalOptions
): Promise<TransitJourneyResult | null> {
  const arrivalDate = nextTransitArrivalDate(
    input.settings.arrivalWeekday,
    input.settings.arrivalHour,
    input.settings.arrivalMinute
  );
  const arrival = formatTransitArrivalForApi(arrivalDate);

  const params = new URLSearchParams({
    "from.latitude": String(input.from.latitude),
    "from.longitude": String(input.from.longitude),
    "from.address": input.fromAddress,
    "to.latitude": String(input.to.latitude),
    "to.longitude": String(input.to.longitude),
    "to.address": input.toAddress,
    arrival,
    results: "1",
    language: "de",
    pretty: "false",
  });

  const bases = resolveTransitApiBases();
  const gtfsBase = resolveTransitGtfsApiBase();
  const fetchInit: RequestInit = {
    headers: { "User-Agent": PICKHOME_TRANSIT_USER_AGENT },
    next: { revalidate: 3600 },
  };
  const attemptsPerProvider =
    options?.maxAttempts ?? (bases.length > 1 ? 0 : undefined);
  const activateCooldownOnFinalFailure = options?.background
    ? (options.activateCooldownOnFailure ?? true)
    : false;

  for (let i = 0; i < bases.length; i++) {
    const url = `${bases[i]}/journeys?${params.toString()}`;
    const res = await fetchExternal("transit", url, fetchInit, {
      ...options,
      maxAttempts: attemptsPerProvider,
      activateCooldownOnFailure: false,
    });

    if (res?.ok) {
      return parseTransitJourneyResponse(res, input.settings);
    }

    if (res && !isRetriableTransitStatus(res.status)) {
      return null;
    }
  }

  if (gtfsBase) {
    const motisResult = await fetchTransitJourneyMotis(
      { from: input.from, to: input.to, settings: input.settings },
      {
        ...options,
        activateCooldownOnFailure: activateCooldownOnFinalFailure,
      }
    );
    if (motisResult) return motisResult;
  }

  if (activateCooldownOnFinalFailure) {
    recordExternalServiceFailure("transit");
  }

  return null;
}

export function formatTransitDuration(seconds: number): string {
  return formatRouteDuration(seconds);
}
