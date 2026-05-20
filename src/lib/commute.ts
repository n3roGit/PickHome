import {
  invalidateCommuteCacheForApartment,
  invalidateCommuteCacheForUser,
  invalidateCommuteCacheForUserAddress,
} from "@/lib/commute-cache";
import { prisma } from "@/lib/prisma";
import { fetchRoute, formatRouteDistance, formatRouteDuration, type RoutePoint } from "@/lib/routing";
import type { TravelMode } from "@/lib/travel-mode";

export type CommuteAddress = {
  id: string;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

export type CommuteLeg = {
  addressId: string;
  label: string;
  address: string;
  distanceText: string | null;
  durationText: string | null;
  unavailableReason: "missing_apartment_coords" | "missing_address_coords" | "routing_failed" | null;
};

export {
  invalidateCommuteCacheForApartment,
  invalidateCommuteCacheForUser,
  invalidateCommuteCacheForUserAddress,
};

export async function computeCommuteLegs(input: {
  apartmentId: string;
  apartment: RoutePoint | null;
  addresses: CommuteAddress[];
  travelMode: TravelMode;
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
        return legFromRoute(addr, cached.distanceMeters, cached.durationSeconds);
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

      return legFromRoute(addr, route.distanceMeters, route.durationSeconds);
    })
  );
}

function legFromRoute(
  addr: CommuteAddress,
  distanceMeters: number,
  durationSeconds: number
): CommuteLeg {
  return {
    addressId: addr.id,
    label: addr.label,
    address: addr.address,
    distanceText: formatRouteDistance(distanceMeters),
    durationText: formatRouteDuration(durationSeconds),
    unavailableReason: null,
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
  };
}
