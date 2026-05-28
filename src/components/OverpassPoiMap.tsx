"use client";

import dynamic from "next/dynamic";
import type { OverpassPoiData } from "@/lib/overpass-poi";

const OverpassPoiMapInner = dynamic(() => import("@/components/OverpassPoiMapInner"), {
  ssr: false,
});

export function OverpassPoiMap({
  latitude,
  longitude,
  data,
}: {
  latitude: number;
  longitude: number;
  data: OverpassPoiData;
}) {
  return (
    <OverpassPoiMapInner latitude={latitude} longitude={longitude} data={data} />
  );
}
