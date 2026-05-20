"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ScoreLegend } from "@/components/ScoreLegend";
import { MAP_MARKER_COLORS } from "@/lib/scoring";
import type { AreaMatchStatus } from "@/lib/area-filter";
import type { PlzMapOverlay } from "@/lib/plz-map-overlays";

export type { PlzMapOverlay };

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

export type MapPinColorMode = "score" | "dealbreaker" | "area";

const MapInner = dynamic(() => import("@/components/ProjectMapInner"), { ssr: false });

export function ProjectMap({
  projectId,
  apartments,
  areaFilterEnabled = false,
}: {
  projectId: string;
  apartments: MapApartment[];
  areaFilterEnabled?: boolean;
}) {
  const [points, setPoints] = useState(apartments);
  const [loading, setLoading] = useState(false);
  const [plzOverlays, setPlzOverlays] = useState<PlzMapOverlay[]>([]);
  const [plzOverlaysLoading, setPlzOverlaysLoading] = useState(false);
  const [colorMode, setColorMode] = useState<MapPinColorMode>(
    areaFilterEnabled ? "area" : "score"
  );
  const [mapReady, setMapReady] = useState(false);
  const [mapMountKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    setMapReady(true);
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

  useEffect(() => {
    if (!areaFilterEnabled) {
      setPlzOverlays([]);
      return;
    }

    let cancelled = false;
    setPlzOverlaysLoading(true);

    void (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/plz-overlays`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { overlays: PlzMapOverlay[] };
        if (!cancelled) {
          setPlzOverlays(data.overlays);
        }
      } finally {
        if (!cancelled) {
          setPlzOverlaysLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [areaFilterEnabled, projectId]);

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
              areaMatchStatus: scored?.areaMatchStatus,
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
      {areaFilterEnabled && mapped.length > 0 && (
        <p className="text-xs text-pn-text-secondary">
          {plzOverlaysLoading
            ? "Wunschgebiet-Kreise werden geladen…"
            : plzOverlays.length > 0
              ? `${plzOverlays.length} grüne Kreise markieren die gewählten PLZ-Bereiche des Wunschgebiets.`
              : "Wunschgebiet ist aktiv, aber es konnten keine PLZ-Bereiche auf der Karte dargestellt werden."}
        </p>
      )}
      {mapped.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-pn-text-secondary">Pin-Farbe:</span>
          {areaFilterEnabled && (
            <button
              type="button"
              onClick={() => setColorMode("area")}
              className={`px-3 py-1 rounded-lg border ${
                colorMode === "area"
                  ? "border-pn-accent bg-pn-accent/10"
                  : "border-pn-border"
              }`}
            >
              Wunschgebiet
            </button>
          )}
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
      ) : !mapReady ? (
        <div className="h-[min(50vh,480px)] min-h-[280px] sm:h-[480px] w-full rounded-xl border border-pn-border bg-pn-bg-subtle" />
      ) : (
        <>
          <MapInner
            key={mapMountKey}
            projectId={projectId}
            apartments={mapped}
            colorMode={colorMode}
            areaFilterPlzOverlays={plzOverlays}
          />
          <div className="flex flex-wrap items-center gap-4 text-xs text-pn-text-secondary">
            {colorMode === "area" ? (
              <span>
                <span style={{ color: MAP_MARKER_COLORS.high }}>Grün</span> = im Wunschgebiet ·{" "}
                <span className="text-pn-text-tertiary">Grau</span> = außerhalb ·{" "}
                <span className="text-amber-700">Gelb</span> = Lage unklar
              </span>
            ) : (
              <>
                <ScoreLegend />
                {colorMode === "dealbreaker" && (
                  <span>
                    Rot = Dealbreaker · sonst nach Score (
                    <span style={{ color: MAP_MARKER_COLORS.high }}>grün</span> /{" "}
                    <span style={{ color: MAP_MARKER_COLORS.mid }}>gelb</span> /{" "}
                    <span style={{ color: MAP_MARKER_COLORS.low }}>rot</span>)
                  </span>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
