"use client";

import dynamic from "next/dynamic";

const ApartmentSunMapInner = dynamic(() => import("@/components/ApartmentSunMapInner"), {
  ssr: false,
});

export function ApartmentSunMap({
  latitude,
  longitude,
  selectedDate,
}: {
  latitude: number;
  longitude: number;
  selectedDate: Date;
}) {
  return (
    <div data-testid="solar-map" className="mt-4">
      <ApartmentSunMapInner
        latitude={latitude}
        longitude={longitude}
        selectedDate={selectedDate}
      />
    </div>
  );
}
