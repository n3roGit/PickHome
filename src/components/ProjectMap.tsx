"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

export type MapApartment = {
  id: string;
  title: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

const MapInner = dynamic(() => import("@/components/ProjectMapInner"), { ssr: false });

export function ProjectMap({
  projectId,
  apartments,
}: {
  projectId: string;
  apartments: MapApartment[];
}) {
  const [points, setPoints] = useState(apartments);
  const [loading, setLoading] = useState(false);
  const withAddress = useMemo(
    () => points.filter((a) => a.address?.trim()),
    [points]
  );

  useEffect(() => {
    setPoints(apartments);
  }, [apartments]);

  async function geocodeMissing() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/geocode`, { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { apartments: MapApartment[] };
        setPoints(data.apartments);
      }
    } finally {
      setLoading(false);
    }
  }

  const mapped = withAddress.filter(
    (a): a is MapApartment & { latitude: number; longitude: number } =>
      a.latitude != null && a.longitude != null
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={geocodeMissing}
          disabled={loading || withAddress.length === 0}
          className="text-sm bg-pn-accent text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? "Adressen werden gesucht…" : "Adressen auf Karte laden"}
        </button>
        <span className="text-sm text-pn-text-tertiary">
          {mapped.length} von {withAddress.length} mit Koordinaten
        </span>
      </div>
      {mapped.length === 0 ? (
        <p className="text-sm text-pn-text-tertiary py-8 text-center">
          Noch keine Standorte. Adressen bei den Immobilien eintragen und „Adressen auf Karte laden“
          klicken.
        </p>
      ) : (
        <MapInner apartments={mapped} />
      )}
    </div>
  );
}
