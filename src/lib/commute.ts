import {
  invalidateCommuteCacheForApartment,
  invalidateCommuteCacheForProject,
  invalidateCommuteCacheForUser,
  invalidateCommuteCacheForUserAddress,
} from "@/lib/commute-cache";
import type { CompanyCarRate } from "@/lib/company-car";
import { distanceKmOneWay, monthlyCommuteBenefitEur } from "@/lib/company-car";
import { prisma } from "@/lib/prisma";
import { fetchRoute, formatRouteDistance, formatRouteDuration, type RoutePoint } from "@/lib/routing";
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
  unavailableReason: "missing_apartment_coords" | "missing_address_coords" | "routing_failed" | null;
  distanceKmOneWay: number | null;
  monthlyCommuteBenefitEur: number | null;
  commuteCostHint: string | null;
};

export type CommuteMemberInput = {
  userId: string;
  name: string;
  travelMode: TravelMode;
  addresses: CommuteAddress[];
  companyCar: boolean;
  companyCarRate: CompanyCarRate | null;
  listPrice: number | null;
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
};

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

export async function computeCommuteForMembers(input: {
  apartmentId: string;
  apartment: RoutePoint | null;
  currentUserId: string;
  members: CommuteMemberInput[];
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
        addresses: member.addresses,
        travelMode: member.travelMode,
        companyCar: member.companyCar,
        companyCarRate: member.companyCarRate,
        listPrice: member.listPrice,
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
  addresses: CommuteAddress[];
  travelMode: TravelMode;
  companyCar: boolean;
  companyCarRate: CompanyCarRate | null;
  listPrice: number | null;
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

  return Promise.all(
    input.addresses.map(async (addr) => {
      if (addr.latitude == null || addr.longitude == null) {
        return legUnavailable(addr, "missing_address_coords");
      }

      const cached = cacheByAddressId.get(addr.id);
      if (cached) {
        return legFromRoute(addr, cached.distanceMeters, cached.durationSeconds, input);
      }

      const route = await fetchRoute(
        input.apartment!,
        { latitude: addr.latitude, longitude: addr.longitude },
        input.travelMode
      );
      if (!route) {
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
          distanceMeters: Math.round(route.distanceMeters),
          durationSeconds: Math.round(route.durationSeconds),
        },
        update: {
          distanceMeters: Math.round(route.distanceMeters),
          durationSeconds: Math.round(route.durationSeconds),
          computedAt: new Date(),
        },
      });

      return legFromRoute(addr, route.distanceMeters, route.durationSeconds, input);
    })
  );
}

function legFromRoute(
  addr: CommuteAddress,
  distanceMeters: number,
  durationSeconds: number,
  member: Pick<CommuteMemberInput, "travelMode" | "companyCar" | "companyCarRate" | "listPrice">
): CommuteLeg {
  const base: CommuteLeg = {
    addressId: addr.id,
    label: addr.label,
    address: addr.address,
    distanceText: formatRouteDistance(distanceMeters),
    durationText: formatRouteDuration(durationSeconds),
    unavailableReason: null,
    distanceKmOneWay: null,
    monthlyCommuteBenefitEur: null,
    commuteCostHint: null,
  };
  return applyCompanyCarCommuteCost(base, addr, distanceMeters, member);
}

function applyCompanyCarCommuteCost(
  leg: CommuteLeg,
  addr: CommuteAddress,
  distanceMeters: number,
  member: Pick<CommuteMemberInput, "travelMode" | "companyCar" | "companyCarRate" | "listPrice">
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

  const monthly = monthlyCommuteBenefitEur({
    listPriceEuros: member.listPrice,
    rate: member.companyCarRate,
    distanceMeters,
  });

  return {
    ...leg,
    distanceKmOneWay: km,
    monthlyCommuteBenefitEur: monthly,
    commuteCostHint: monthly == null ? "Arbeitsweg-Kosten konnten nicht berechnet werden." : null,
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
    unavailableReason: reason,
    distanceKmOneWay: null,
    monthlyCommuteBenefitEur: null,
    commuteCostHint: null,
  };
}
