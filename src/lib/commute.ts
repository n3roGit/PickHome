import {
  invalidateCommuteCacheForApartment,
  invalidateCommuteCacheForProject,
  invalidateCommuteCacheForUser,
  invalidateCommuteCacheForUserAddress,
} from "@/lib/commute-cache";
import type { FetchExternalOptions } from "@/lib/external-fetch";
import { backgroundThrottlePause } from "@/lib/background-task";
import type { CompanyCarCommuteMethod, CompanyCarRate } from "@/lib/company-car";
import { distanceKmOneWay, monthlyCompanyCarBenefitEur } from "@/lib/company-car";
import { prisma } from "@/lib/prisma";
import { consumeExternalServiceUnavailable } from "@/lib/external-fetch";
import { fetchRoute, formatRouteDistance, formatRouteDuration, type RoutePoint } from "@/lib/routing";
import {
  fetchTransitJourney,
  formatTransitDetailTooltip,
  parseTransitLegDetails,
  serializeTransitLegDetails,
} from "@/lib/transit-routing";
import {
  parseCommuteRouteKind,
  shouldUseTransitOsrmFallback,
  transitRoutingNote,
  type CommuteRouteKind,
  type TransitSettings,
} from "@/lib/transit-settings";
import type { TravelMode } from "@/lib/travel-mode";

export type CommuteAddress = {
  id: string;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  isWorkplace: boolean;
};

export type CommuteLeg = {
  addressId: string;
  label: string;
  address: string;
  distanceText: string | null;
  durationText: string | null;
  connectionSummary: string | null;
  transitDetailTooltip: string | null;
  routingNote: string | null;
  unavailableReason:
    | "missing_apartment_coords"
    | "missing_address_coords"
    | "routing_failed"
    | "api_unavailable"
    | null;
  distanceKmOneWay: number | null;
  monthlyCompanyCarBaseBenefitEur: number | null;
  monthlyCompanyCarCommuteBenefitEur: number | null;
  monthlyCompanyCarTotalBenefitEur: number | null;
  monthlyCompanyCarTotalNetBenefitEur: number | null;
  monthlyCompanyCarDeductionsEur: number | null;
  companyCarMarginalTaxRatePercent: number | null;
  companyCarCommuteMethod: CompanyCarCommuteMethod | null;
  companyCarOfficeTripsPerMonth: number | null;
  companyCarEmployerFuelCard: boolean | null;
  commuteCostHint: string | null;
};

export type CommuteMemberInput = {
  userId: string;
  name: string;
  travelMode: TravelMode;
  transitSettings: TransitSettings | null;
  addresses: CommuteAddress[];
  companyCar: boolean;
  companyCarRate: CompanyCarRate | null;
  listPrice: number | null;
  marginalTaxRatePercent: number | null;
  companyCarCommuteMethod: CompanyCarCommuteMethod | null;
  companyCarOfficeTripsPerMonth: number | null;
  companyCarContributionEur: number | null;
  companyCarSelfPaidCostsEur: number | null;
  companyCarEmployerFuelCard: boolean;
};

export type CommutePersonEstimate = {
  userId: string;
  name: string;
  isCurrentUser: boolean;
  travelMode: TravelMode;
  legs: CommuteLeg[];
};

const UNAVAILABLE_MESSAGES: Record<NonNullable<CommuteLeg["unavailableReason"]>, string> = {
  missing_apartment_coords: "Immobilie hat keine Koordinaten (Adresse fehlt oder nicht geocodiert).",
  missing_address_coords: "Adresse konnte nicht geocodiert werden.",
  routing_failed: "Route konnte nicht berechnet werden.",
  api_unavailable:
    "Routing-API vorübergehend nicht erreichbar — wird im Hintergrund erneut versucht.",
};

export const COMMUTE_PENDING_NOTE =
  "Anfahrtszeit wird im Hintergrund berechnet — Seite später neu laden.";

export const COMMUTE_TRANSIT_PENDING_NOTE = "Daten werden berechnet";

/** @deprecated Use COMMUTE_PENDING_NOTE */
export const COMMUTE_REINDEX_PENDING_NOTE = COMMUTE_PENDING_NOTE;

export function commuteUnavailableMessage(reason: CommuteLeg["unavailableReason"]): string | null {
  if (!reason) return null;
  return UNAVAILABLE_MESSAGES[reason];
}

export {
  invalidateCommuteCacheForApartment,
  invalidateCommuteCacheForProject,
  invalidateCommuteCacheForUser,
  invalidateCommuteCacheForUserAddress,
};

type ResolvedCommuteRoute = {
  distanceMeters: number;
  durationSeconds: number;
  routeKind: CommuteRouteKind;
  connectionSummary: string | null;
  transitDetailJson: string | null;
  effectiveMode: string | null;
  routingNote: string | null;
};

export async function computeCommuteForMembers(input: {
  apartmentId: string;
  apartment: RoutePoint | null;
  apartmentAddress?: string | null;
  currentUserId: string;
  members: CommuteMemberInput[];
  cacheOnly?: boolean;
}): Promise<CommutePersonEstimate[]> {
  const estimates = await Promise.all(
    input.members.map(async (member) => ({
      userId: member.userId,
      name: member.name,
      isCurrentUser: member.userId === input.currentUserId,
      travelMode: member.travelMode,
      legs: await computeCommuteLegs({
        apartmentId: input.apartmentId,
        apartment: input.apartment,
        apartmentAddress: input.apartmentAddress,
        addresses: member.addresses,
        travelMode: member.travelMode,
        transitSettings: member.transitSettings,
        companyCar: member.companyCar,
        companyCarRate: member.companyCarRate,
        listPrice: member.listPrice,
        marginalTaxRatePercent: member.marginalTaxRatePercent,
        companyCarCommuteMethod: member.companyCarCommuteMethod,
        companyCarOfficeTripsPerMonth: member.companyCarOfficeTripsPerMonth,
        companyCarContributionEur: member.companyCarContributionEur,
        companyCarSelfPaidCostsEur: member.companyCarSelfPaidCostsEur,
        companyCarEmployerFuelCard: member.companyCarEmployerFuelCard,
        cacheOnly: input.cacheOnly,
      }),
    }))
  );

  return estimates.sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    return a.name.localeCompare(b.name, "de");
  });
}

export async function computeCommuteLegs(input: {
  apartmentId: string;
  apartment: RoutePoint | null;
  apartmentAddress?: string | null;
  addresses: CommuteAddress[];
  travelMode: TravelMode;
  transitSettings: TransitSettings | null;
  companyCar: boolean;
  companyCarRate: CompanyCarRate | null;
  listPrice: number | null;
  marginalTaxRatePercent: number | null;
  companyCarCommuteMethod: CompanyCarCommuteMethod | null;
  companyCarOfficeTripsPerMonth: number | null;
  companyCarContributionEur: number | null;
  companyCarSelfPaidCostsEur: number | null;
  companyCarEmployerFuelCard: boolean;
  background?: boolean;
  cacheOnly?: boolean;
}): Promise<CommuteLeg[]> {
  if (input.addresses.length === 0) return [];

  if (!input.apartment) {
    return input.addresses.map((addr) => legUnavailable(addr, "missing_apartment_coords"));
  }

  const cachedRows = await prisma.commuteCache.findMany({
    where: {
      apartmentId: input.apartmentId,
      travelMode: input.travelMode,
      userAddressId: { in: input.addresses.map((a) => a.id) },
    },
  });
  const cacheByAddressId = new Map(cachedRows.map((row) => [row.userAddressId, row]));
  const fetchOptions: FetchExternalOptions | undefined = input.background ? { background: true } : undefined;
  const drivingDistanceHints =
    input.cacheOnly && input.travelMode === "transit"
      ? await ensureDrivingDistanceHints({
          apartmentId: input.apartmentId,
          apartment: input.apartment,
          addresses: input.addresses,
          fetchOptions,
        })
      : null;

  const computeOne = async (addr: CommuteAddress): Promise<CommuteLeg> => {
    if (addr.latitude == null || addr.longitude == null) {
      return legUnavailable(addr, "missing_address_coords");
    }

    const cached = cacheByAddressId.get(addr.id);
    if (cached) {
      return legFromResolved(
        addr,
        {
          distanceMeters: cached.distanceMeters,
          durationSeconds: cached.durationSeconds,
          routeKind: parseCommuteRouteKind(cached.routeKind) ?? "osrm",
          connectionSummary: cached.connectionSummary,
          transitDetailJson: cached.transitDetailJson,
          effectiveMode: cached.effectiveMode,
          routingNote:
            cached.routeKind === "transit_fallback" &&
            cached.effectiveMode &&
            input.transitSettings?.fallbackMaxKm
              ? transitRoutingNote(
                  cached.effectiveMode as "foot" | "bike",
                  input.transitSettings.fallbackMaxKm
                )
              : null,
        },
        input
      );
    }

    if (input.cacheOnly) {
      if (input.travelMode === "transit") {
        return legTransitPending(addr, drivingDistanceHints?.get(addr.id) ?? null);
      }
      return legReindexPending(addr);
    }

    const resolved = await resolveCommuteRoute(
      {
        apartment: input.apartment!,
        apartmentAddress: input.apartmentAddress,
        destination: { latitude: addr.latitude, longitude: addr.longitude },
        destinationAddress: addr.address,
        travelMode: input.travelMode,
        transitSettings: input.transitSettings,
      },
      fetchOptions
    );
    if (!resolved) {
      const service = input.travelMode === "transit" ? "transit" : "osrm";
      if (consumeExternalServiceUnavailable(service)) {
        return legUnavailable(addr, "api_unavailable");
      }
      return legUnavailable(addr, "routing_failed");
    }

    await prisma.commuteCache.upsert({
      where: {
        apartmentId_userAddressId_travelMode: {
          apartmentId: input.apartmentId,
          userAddressId: addr.id,
          travelMode: input.travelMode,
        },
      },
      create: {
        apartmentId: input.apartmentId,
        userAddressId: addr.id,
        travelMode: input.travelMode,
        distanceMeters: Math.round(resolved.distanceMeters),
        durationSeconds: Math.round(resolved.durationSeconds),
        routeKind: resolved.routeKind,
        connectionSummary: resolved.connectionSummary,
        transitDetailJson: resolved.transitDetailJson,
        effectiveMode: resolved.effectiveMode,
      },
      update: {
        distanceMeters: Math.round(resolved.distanceMeters),
        durationSeconds: Math.round(resolved.durationSeconds),
        routeKind: resolved.routeKind,
        connectionSummary: resolved.connectionSummary,
        transitDetailJson: resolved.transitDetailJson,
        effectiveMode: resolved.effectiveMode,
        computedAt: new Date(),
      },
    });

    return legFromResolved(addr, resolved, input);
  };

  if (input.background) {
    const legs: CommuteLeg[] = [];
    for (const addr of input.addresses) {
      legs.push(await computeOne(addr));
      await backgroundThrottlePause(250);
    }
    return legs;
  }

  return Promise.all(input.addresses.map((addr) => computeOne(addr)));
}

async function ensureDrivingDistanceHints(input: {
  apartmentId: string;
  apartment: RoutePoint;
  addresses: CommuteAddress[];
  fetchOptions?: FetchExternalOptions;
}): Promise<Map<string, string>> {
  const hints = new Map<string, string>();
  const routableAddresses = input.addresses.filter(
    (addr) => addr.latitude != null && addr.longitude != null
  );
  if (routableAddresses.length === 0) return hints;

  const cachedDriving = await prisma.commuteCache.findMany({
    where: {
      apartmentId: input.apartmentId,
      travelMode: "driving",
      userAddressId: { in: routableAddresses.map((addr) => addr.id) },
    },
  });
  for (const row of cachedDriving) {
    hints.set(row.userAddressId, formatRouteDistance(row.distanceMeters));
  }

  const missing = routableAddresses.filter((addr) => !hints.has(addr.id));
  await Promise.all(
    missing.map(async (addr) => {
      const route = await fetchRoute(
        input.apartment,
        { latitude: addr.latitude!, longitude: addr.longitude! },
        "driving",
        input.fetchOptions
      );
      if (!route) return;

      hints.set(addr.id, formatRouteDistance(route.distanceMeters));
      await prisma.commuteCache.upsert({
        where: {
          apartmentId_userAddressId_travelMode: {
            apartmentId: input.apartmentId,
            userAddressId: addr.id,
            travelMode: "driving",
          },
        },
        create: {
          apartmentId: input.apartmentId,
          userAddressId: addr.id,
          travelMode: "driving",
          distanceMeters: Math.round(route.distanceMeters),
          durationSeconds: Math.round(route.durationSeconds),
          routeKind: "osrm",
          connectionSummary: null,
          transitDetailJson: null,
          effectiveMode: null,
        },
        update: {
          distanceMeters: Math.round(route.distanceMeters),
          durationSeconds: Math.round(route.durationSeconds),
          routeKind: "osrm",
          connectionSummary: null,
          transitDetailJson: null,
          effectiveMode: null,
          computedAt: new Date(),
        },
      });
    })
  );

  return hints;
}

async function resolveCommuteRoute(
  input: {
    apartment: RoutePoint;
    apartmentAddress?: string | null;
    destination: RoutePoint;
    destinationAddress: string;
    travelMode: TravelMode;
    transitSettings: TransitSettings | null;
  },
  fetchOptions?: FetchExternalOptions
): Promise<ResolvedCommuteRoute | null> {
  if (input.travelMode !== "transit") {
    const route = await fetchRoute(input.apartment, input.destination, input.travelMode, fetchOptions);
    if (!route) return null;
    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      routeKind: "osrm",
      connectionSummary: null,
      transitDetailJson: null,
      effectiveMode: null,
      routingNote: null,
    };
  }

  const settings = input.transitSettings;
  if (!settings) return null;

  if (settings.fallbackMaxKm != null && settings.fallbackMaxKm > 0 && settings.fallbackMode) {
    const fallbackRoute = await fetchRoute(
      input.apartment,
      input.destination,
      settings.fallbackMode,
      fetchOptions
    );
    if (
      fallbackRoute &&
      shouldUseTransitOsrmFallback(fallbackRoute.distanceMeters, settings)
    ) {
      return {
        distanceMeters: fallbackRoute.distanceMeters,
        durationSeconds: fallbackRoute.durationSeconds,
        routeKind: "transit_fallback",
        connectionSummary: null,
        transitDetailJson: null,
        effectiveMode: settings.fallbackMode,
        routingNote: transitRoutingNote(settings.fallbackMode, settings.fallbackMaxKm),
      };
    }
  }

  const fromAddress = input.apartmentAddress?.trim() || "Wohnung";
  const journey = await fetchTransitJourney(
    {
      from: input.apartment,
      fromAddress,
      to: input.destination,
      toAddress: input.destinationAddress,
      settings,
    },
    fetchOptions
  );
  if (!journey) return null;

  const connectionSummary = `${journey.connectionSummary} (${journey.arrivalTargetLabel})`;

  return {
    distanceMeters: journey.distanceMeters,
    durationSeconds: journey.durationSeconds,
    routeKind: "transit",
    connectionSummary,
    transitDetailJson: serializeTransitLegDetails(journey.legDetails),
    effectiveMode: null,
    routingNote: null,
  };
}

function transitDetailTooltipFromJson(transitDetailJson: string | null): string | null {
  const legs = parseTransitLegDetails(transitDetailJson);
  if (!legs?.length) return null;
  return formatTransitDetailTooltip(legs);
}

function transitDetailTooltipFromResolved(resolved: ResolvedCommuteRoute): string | null {
  return transitDetailTooltipFromJson(resolved.transitDetailJson);
}

function legFromResolved(
  addr: CommuteAddress,
  resolved: ResolvedCommuteRoute,
  member: Pick<
    CommuteMemberInput,
    | "travelMode"
    | "companyCar"
    | "companyCarRate"
    | "listPrice"
    | "marginalTaxRatePercent"
    | "companyCarCommuteMethod"
    | "companyCarOfficeTripsPerMonth"
    | "companyCarContributionEur"
    | "companyCarSelfPaidCostsEur"
    | "companyCarEmployerFuelCard"
  >
): CommuteLeg {
  const showDistance =
    resolved.routeKind !== "transit" || resolved.distanceMeters > 0;

  const base: CommuteLeg = {
    addressId: addr.id,
    label: addr.label,
    address: addr.address,
    distanceText: showDistance ? formatRouteDistance(resolved.distanceMeters) : null,
    durationText: formatRouteDuration(resolved.durationSeconds),
    connectionSummary: resolved.connectionSummary,
    transitDetailTooltip: transitDetailTooltipFromResolved(resolved),
    routingNote: resolved.routingNote,
    unavailableReason: null,
    distanceKmOneWay: null,
    monthlyCompanyCarBaseBenefitEur: null,
    monthlyCompanyCarCommuteBenefitEur: null,
    monthlyCompanyCarTotalBenefitEur: null,
    monthlyCompanyCarTotalNetBenefitEur: null,
    monthlyCompanyCarDeductionsEur: null,
    companyCarMarginalTaxRatePercent: null,
    companyCarCommuteMethod: null,
    companyCarOfficeTripsPerMonth: null,
    companyCarEmployerFuelCard: null,
    commuteCostHint: null,
  };
  return applyCompanyCarCommuteCost(base, addr, resolved.distanceMeters, member);
}

function applyCompanyCarCommuteCost(
  leg: CommuteLeg,
  addr: CommuteAddress,
  distanceMeters: number,
  member: Pick<
    CommuteMemberInput,
    | "travelMode"
    | "companyCar"
    | "companyCarRate"
    | "listPrice"
    | "marginalTaxRatePercent"
    | "companyCarCommuteMethod"
    | "companyCarOfficeTripsPerMonth"
    | "companyCarContributionEur"
    | "companyCarSelfPaidCostsEur"
    | "companyCarEmployerFuelCard"
  >
): CommuteLeg {
  if (member.travelMode !== "driving" || !member.companyCar || !addr.isWorkplace) {
    return leg;
  }

  const km = distanceKmOneWay(distanceMeters);
  if (!member.listPrice || !member.companyCarRate) {
    return {
      ...leg,
      distanceKmOneWay: km,
      commuteCostHint: "Bruttolistenpreis oder Antriebsart fehlt — in den Kontoeinstellungen hinterlegen.",
    };
  }

  const commuteMethod = member.companyCarCommuteMethod ?? "distance";
  if (commuteMethod === "trips" && !member.companyCarOfficeTripsPerMonth) {
    return {
      ...leg,
      distanceKmOneWay: km,
      commuteCostHint: "Bürofahrten pro Monat fehlt — in den Kontoeinstellungen hinterlegen.",
    };
  }

  const benefit = monthlyCompanyCarBenefitEur({
    listPriceEuros: member.listPrice,
    rate: member.companyCarRate,
    distanceMeters,
    commuteMethod,
    officeTripsPerMonth: member.companyCarOfficeTripsPerMonth,
    contributionEur: member.companyCarContributionEur,
    selfPaidCostsEur: member.companyCarSelfPaidCostsEur,
    employerFuelCard: member.companyCarEmployerFuelCard,
    marginalTaxRatePercent: member.marginalTaxRatePercent,
  });

  return {
    ...leg,
    distanceKmOneWay: km,
    monthlyCompanyCarBaseBenefitEur: benefit?.baseGrossEur ?? null,
    monthlyCompanyCarCommuteBenefitEur: benefit?.commuteGrossEur ?? null,
    monthlyCompanyCarTotalBenefitEur: benefit?.totalGrossEur ?? null,
    monthlyCompanyCarTotalNetBenefitEur: benefit?.totalNetEur ?? null,
    monthlyCompanyCarDeductionsEur: benefit?.deductionsEur ?? null,
    companyCarMarginalTaxRatePercent: benefit?.marginalTaxRatePercent ?? null,
    companyCarCommuteMethod: benefit?.commuteMethod ?? null,
    companyCarOfficeTripsPerMonth: benefit?.officeTripsPerMonth ?? null,
    companyCarEmployerFuelCard: benefit?.employerFuelCard ?? null,
    commuteCostHint: benefit == null ? "Firmenwagen-Kosten konnten nicht berechnet werden." : null,
  };
}

function legTransitPending(addr: CommuteAddress, drivingDistanceText: string | null): CommuteLeg {
  return {
    addressId: addr.id,
    label: addr.label,
    address: addr.address,
    distanceText: drivingDistanceText,
    durationText: null,
    connectionSummary: null,
    transitDetailTooltip: null,
    routingNote: COMMUTE_TRANSIT_PENDING_NOTE,
    unavailableReason: null,
    distanceKmOneWay: null,
    monthlyCompanyCarBaseBenefitEur: null,
    monthlyCompanyCarCommuteBenefitEur: null,
    monthlyCompanyCarTotalBenefitEur: null,
    monthlyCompanyCarTotalNetBenefitEur: null,
    monthlyCompanyCarDeductionsEur: null,
    companyCarMarginalTaxRatePercent: null,
    companyCarCommuteMethod: null,
    companyCarOfficeTripsPerMonth: null,
    companyCarEmployerFuelCard: null,
    commuteCostHint: null,
  };
}

function legReindexPending(addr: CommuteAddress): CommuteLeg {
  return {
    addressId: addr.id,
    label: addr.label,
    address: addr.address,
    distanceText: null,
    durationText: null,
    connectionSummary: null,
    transitDetailTooltip: null,
    routingNote: COMMUTE_PENDING_NOTE,
    unavailableReason: null,
    distanceKmOneWay: null,
    monthlyCompanyCarBaseBenefitEur: null,
    monthlyCompanyCarCommuteBenefitEur: null,
    monthlyCompanyCarTotalBenefitEur: null,
    monthlyCompanyCarTotalNetBenefitEur: null,
    monthlyCompanyCarDeductionsEur: null,
    companyCarMarginalTaxRatePercent: null,
    companyCarCommuteMethod: null,
    companyCarOfficeTripsPerMonth: null,
    companyCarEmployerFuelCard: null,
    commuteCostHint: null,
  };
}

function legUnavailable(
  addr: CommuteAddress,
  reason: CommuteLeg["unavailableReason"]
): CommuteLeg {
  return {
    addressId: addr.id,
    label: addr.label,
    address: addr.address,
    distanceText: null,
    durationText: null,
    connectionSummary: null,
    transitDetailTooltip: null,
    routingNote: null,
    unavailableReason: reason,
    distanceKmOneWay: null,
    monthlyCompanyCarBaseBenefitEur: null,
    monthlyCompanyCarCommuteBenefitEur: null,
    monthlyCompanyCarTotalBenefitEur: null,
    monthlyCompanyCarTotalNetBenefitEur: null,
    monthlyCompanyCarDeductionsEur: null,
    companyCarMarginalTaxRatePercent: null,
    companyCarCommuteMethod: null,
    companyCarOfficeTripsPerMonth: null,
    companyCarEmployerFuelCard: null,
    commuteCostHint: null,
  };
}
