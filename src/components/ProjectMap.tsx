"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ScoreLegend } from "@/components/ScoreLegend";
import type { AreaFilterMode } from "@/lib/area-filter";
import type { AreaMatchStatus } from "@/lib/area-filter";
import type { PlzMapOverlay } from "@/lib/plz-map-overlays";
import { PoiCategoryLegend } from "@/components/PoiCategoryLegend";
import type { ProjectMapPoi } from "@/lib/project-map-pois";
import {
  countPoisByCategory,
  OVERPASS_RADIUS_WIDE_M,
  type PoiCategoryId,
} from "@/lib/overpass-poi";

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

const MapInner = dynamic(() => import("@/components/ProjectMapInner"), { ssr: false });

export function ProjectMap({
  projectId,
  apartments,
  areaFilterEnabled = false,
  areaFilterMode = "allow",
  areaFilterCircleRadiusM,
}: {
  projectId: string;
  apartments: MapApartment[];
  areaFilterEnabled?: boolean;
  areaFilterMode?: AreaFilterMode;
  areaFilterCircleRadiusM?: number;
}) {
  const [points, setPoints] = useState(apartments);
  const [loading, setLoading] = useState(false);
  const [plzOverlays, setPlzOverlays] = useState<PlzMapOverlay[]>([]);
  const [showDesiredAreas, setShowDesiredAreas] = useState(true);
  const [showPois, setShowPois] = useState(false);
  const [poiMarkers, setPoiMarkers] = useState<ProjectMapPoi[]>([]);
  const [poisLoading, setPoisLoading] = useState(false);
  const [poisLoaded, setPoisLoaded] = useState(false);
  const [hiddenPoiCategories, setHiddenPoiCategories] = useState<Set<PoiCategoryId>>(
    () => new Set()
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
    setPoisLoaded(false);
    setPoiMarkers([]);
    setShowPois(false);
    setHiddenPoiCategories(new Set());
  }, [apartments]);

  useEffect(() => {
    if (!areaFilterEnabled) {
      setPlzOverlays([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/plz-overlays`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { overlays: PlzMapOverlay[] };
        if (!cancelled) {
          setPlzOverlays(data.overlays);
        }
      } catch {
        if (!cancelled) {
          setPlzOverlays([]);
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

  const mapped = useMemo(
    () =>
      withAddress.filter(
        (a): a is MappedApartment => a.latitude != null && a.longitude != null
      ),
    [withAddress]
  );
  const areaOverlayLabel = areaFilterMode === "deny" ? "NoGo-Zonen" : "Wunschgebiete";
  const radiusKmLabel =
    areaFilterCircleRadiusM != null
      ? `${(areaFilterCircleRadiusM / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km`
      : null;
  const areaOverlayHint =
    areaFilterMode === "deny"
      ? `${plzOverlays.length} rote Kreise (Radius ${radiusKmLabel ?? "…"}) markieren die ausgeschlossenen PLZ-Bereiche.`
      : `${plzOverlays.length} grüne Kreise (Radius ${radiusKmLabel ?? "…"}) markieren die gewählten PLZ-Bereiche des Wunschgebiets.`;
  const visiblePlzOverlays =
    areaFilterEnabled && showDesiredAreas ? plzOverlays : [];

  async function togglePois() {
    const next = !showPois;
    setShowPois(next);
    if (!next) return;

    if (poisLoaded) return;

    setPoisLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/map-pois`);
      if (res.ok) {
        const data = (await res.json()) as { markers: ProjectMapPoi[] };
        setPoiMarkers(data.markers);
        setPoisLoaded(true);
      }
    } finally {
      setPoisLoading(false);
    }
  }

  const visiblePois = useMemo(() => {
    if (!showPois) return [];
    return poiMarkers.filter((p) => !hiddenPoiCategories.has(p.categoryId));
  }, [showPois, poiMarkers, hiddenPoiCategories]);

  function togglePoiCategory(id: PoiCategoryId) {
    setHiddenPoiCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        {areaFilterEnabled && mapped.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDesiredAreas((current) => !current)}
            className={`text-sm px-3 py-1.5 rounded-lg border ${
              showDesiredAreas
                ? "border-pn-accent bg-pn-accent/10 text-pn-text-primary"
                : "border-pn-border text-pn-text-secondary"
            }`}
          >
            {showDesiredAreas ? `${areaOverlayLabel} ausblenden` : `${areaOverlayLabel} anzeigen`}
          </button>
        )}
        {mapped.length > 0 && (
          <button
            type="button"
            onClick={() => void togglePois()}
            disabled={poisLoading}
            className={`text-sm px-3 py-1.5 rounded-lg border disabled:opacity-50 ${
              showPois
                ? "border-pn-accent bg-pn-accent/10 text-pn-text-primary"
                : "border-pn-border text-pn-text-secondary"
            }`}
          >
            {poisLoading
              ? "POIs werden geladen…"
              : showPois
                ? "POIs ausblenden"
                : "POIs anzeigen"}
          </button>
        )}
      </div>
      {areaFilterEnabled && showDesiredAreas && mapped.length > 0 && plzOverlays.length > 0 && (
        <p className="text-xs text-pn-text-secondary">{areaOverlayHint}</p>
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
            areaFilterPlzOverlays={visiblePlzOverlays}
            areaFilterMode={areaFilterMode}
            poiMarkers={visiblePois}
          />
          <ScoreLegend />
          {showPois && poisLoaded ? (
            poiMarkers.length > 0 ? (
              <PoiCategoryLegend
                counts={countPoisByCategory(poiMarkers)}
                hiddenCategories={hiddenPoiCategories}
                onToggleCategory={togglePoiCategory}
                footer={`Umkreis ${OVERPASS_RADIUS_WIDE_M} m je Immobilie · ${visiblePois.length} von ${poiMarkers.length} POIs sichtbar`}
              />
            ) : (
              <p className="text-xs text-pn-text-secondary">
                Keine POI-Daten geladen — erneut „POIs anzeigen“ wählen oder bei einer
                Immobilie unter „Standort & Umfeld“ aktualisieren.
              </p>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
