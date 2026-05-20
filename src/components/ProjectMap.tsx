"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ScoreLegend } from "@/components/ScoreLegend";
import { MAP_MARKER_COLORS } from "@/lib/scoring";
import type { AreaMatchStatus } from "@/lib/area-filter";

export type PlzMapOverlay = { plz: string; lat: number; lng: number };

export type MapApartment = {
  id: string;
  title: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  score: number;
  displayScore: number;
  dealbreaker: boolean;
  areaMatchStatus?: AreaMatchStatus;
};

export type MappedApartment = MapApartment & { latitude: number; longitude: number };

const MapInner = dynamic(() => import("@/components/ProjectMapInner"), { ssr: false });

export function ProjectMap({
  projectId,
  apartments,
  areaFilterPlzOverlays = [],
}: {
  projectId: string;
  apartments: MapApartment[];
  areaFilterPlzOverlays?: PlzMapOverlay[];
}) {
  const [points, setPoints] = useState(apartments);
  const [loading, setLoading] = useState(false);
  const [colorMode, setColorMode] = useState<"score" | "dealbreaker">("score");
  const [mapMountKey, setMapMountKey] = useState<number | null>(null);

  useEffect(() => {
    setMapMountKey(Date.now());
    return () => setMapMountKey(null);
  }, []);
  const scoreById = useMemo(
    () => new Map(apartments.map((a) => [a.id, a])),
    [apartments]
  );

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
        const data = (await res.json()) as {
          apartments: Array<{
            id: string;
            title: string;
            address: string | null;
            latitude: number | null;
            longitude: number | null;
          }>;
        };
        setPoints(
          data.apartments.map((a) => {
            const scored = scoreById.get(a.id);
            return {
              ...a,
              score: scored?.score ?? 0,
              displayScore: scored?.displayScore ?? 0,
              dealbreaker: scored?.dealbreaker ?? false,
            };
          })
        );
      }
    } finally {
      setLoading(false);
    }
  }

  const mapped = withAddress.filter(
    (a): a is MappedApartment => a.latitude != null && a.longitude != null
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
      {mapped.length > 0 && areaFilterPlzOverlays.length > 0 && (
        <p className="text-xs text-pn-text-secondary">
          Grüne Kreise markieren die gewählten PLZ-Bereiche des Wunschgebiets.
        </p>
      )}
      {mapped.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-pn-text-secondary">Pin-Farbe:</span>
          <button
            type="button"
            onClick={() => setColorMode("score")}
            className={`px-3 py-1 rounded-lg border ${
              colorMode === "score"
                ? "border-pn-accent bg-pn-accent/10"
                : "border-pn-border"
            }`}
          >
            Score
          </button>
          <button
            type="button"
            onClick={() => setColorMode("dealbreaker")}
            className={`px-3 py-1 rounded-lg border ${
              colorMode === "dealbreaker"
                ? "border-pn-accent bg-pn-accent/10"
                : "border-pn-border"
            }`}
          >
            Dealbreaker
          </button>
        </div>
      )}
      {mapped.length === 0 ? (
        <p className="text-sm text-pn-text-tertiary py-8 text-center">
          Noch keine Standorte. Adressen bei den Immobilien eintragen und „Adressen auf Karte laden“
          klicken.
        </p>
      ) : (
        <>
          <DeferredMapInner
            mountKey={mapMountKey}
            projectId={projectId}
            apartments={mapped}
            colorMode={colorMode}
            areaFilterPlzOverlays={areaFilterPlzOverlays}
          />
          <div className="flex flex-wrap items-center gap-4 text-xs text-pn-text-secondary">
            <ScoreLegend />
            {colorMode === "dealbreaker" && (
              <span>
                Rot = Dealbreaker · sonst nach Score (
                <span style={{ color: MAP_MARKER_COLORS.high }}>grün</span> /{" "}
                <span style={{ color: MAP_MARKER_COLORS.mid }}>gelb</span> /{" "}
                <span style={{ color: MAP_MARKER_COLORS.low }}>rot</span>)
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DeferredMapInner({
  mountKey,
  projectId,
  apartments,
  colorMode,
  areaFilterPlzOverlays,
}: {
  mountKey: number | null;
  projectId: string;
  apartments: MappedApartment[];
  colorMode: "score" | "dealbreaker";
  areaFilterPlzOverlays: PlzMapOverlay[];
}) {
  if (mountKey == null) {
    return (
      <div className="h-[min(50vh,480px)] min-h-[280px] sm:h-[480px] w-full rounded-xl border border-pn-border bg-pn-bg-subtle" />
    );
  }
  return (
    <MapInner
      key={mountKey}
      projectId={projectId}
      apartments={apartments}
      colorMode={colorMode}
      areaFilterPlzOverlays={areaFilterPlzOverlays}
    />
  );
}
