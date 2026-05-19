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

export async function computeCommuteLegs(input: {
  apartment: RoutePoint | null;
  addresses: CommuteAddress[];
  travelMode: TravelMode;
}): Promise<CommuteLeg[]> {
  return Promise.all(
    input.addresses.map(async (addr) => {
      if (!input.apartment) {
        return legUnavailable(addr, "missing_apartment_coords");
      }
      if (addr.latitude == null || addr.longitude == null) {
        return legUnavailable(addr, "missing_address_coords");
      }

      const route = await fetchRoute(
        input.apartment,
        { latitude: addr.latitude, longitude: addr.longitude },
        input.travelMode
      );
      if (!route) {
        return legUnavailable(addr, "routing_failed");
      }

      return {
        addressId: addr.id,
        label: addr.label,
        address: addr.address,
        distanceText: formatRouteDistance(route.distanceMeters),
        durationText: formatRouteDuration(route.durationSeconds),
        unavailableReason: null,
      };
    })
  );
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
