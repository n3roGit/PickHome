"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { createRoot, type Root } from "react-dom/client";
import { ScoreBadge } from "@/components/ScoreBadge";
import { DesiredAreaBadge } from "@/components/DesiredAreaBadge";
import { markerColorForScore } from "@/lib/scoring";
import type { MappedApartment, PlzMapOverlay } from "@/components/ProjectMap";
import type { AreaFilterMode } from "@/lib/area-filter";
import { DEFAULT_PLZ_OVERLAY_RADIUS_M } from "@/lib/plz-map-overlays";

const DESIRED_AREA_FILL = "#22c55e";
const DESIRED_AREA_STROKE = "#15803d";
const NOGO_AREA_FILL = "#ef4444";
const NOGO_AREA_STROKE = "#b91c1c";
const DESIRED_AREA_FILL_OPACITY = 0.28;

function markerIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function PopupContent({
  apartment,
  projectId,
  areaFilterMode,
}: {
  apartment: MappedApartment;
  projectId: string;
  areaFilterMode: AreaFilterMode;
}) {
  return (
    <div>
      <p className="font-semibold text-sm">{apartment.title}</p>
      {apartment.address && <p className="text-xs mt-1">{apartment.address}</p>}
      {apartment.areaMatchStatus && apartment.areaMatchStatus !== "unset" && (
        <div className="mt-1">
          <DesiredAreaBadge status={apartment.areaMatchStatus} mode={areaFilterMode} />
        </div>
      )}
      <div className="mt-2">
        <ScoreBadge
          score={apartment.score}
          displayScore={apartment.displayScore}
          dealbreaker={apartment.dealbreaker}
        />
      </div>
      <Link
        href={`/project/${projectId}/apartment/${apartment.id}`}
        className="text-xs text-pn-accent hover:underline mt-2 inline-block"
      >
        Details öffnen
      </Link>
    </div>
  );
}

export default function ProjectMapInner({
  projectId,
  apartments,
  areaFilterPlzOverlays,
  areaFilterMode = "allow",
}: {
  projectId: string;
  apartments: MappedApartment[];
  areaFilterPlzOverlays: PlzMapOverlay[];
  areaFilterMode?: AreaFilterMode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const popupRootsRef = useRef<Root[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || apartments.length === 0) return;

    const center = apartments[0];
    const map = L.map(container, { scrollWheelZoom: true }).setView(
      [center.latitude, center.longitude],
      11
    );
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const bounds = L.latLngBounds([]);

    const overlayFill = areaFilterMode === "deny" ? NOGO_AREA_FILL : DESIRED_AREA_FILL;
    const overlayStroke = areaFilterMode === "deny" ? NOGO_AREA_STROKE : DESIRED_AREA_STROKE;

    for (const entry of areaFilterPlzOverlays) {
      const radiusM = entry.radiusM ?? DEFAULT_PLZ_OVERLAY_RADIUS_M;
      const circle = L.circle([entry.lat, entry.lng], {
        radius: radiusM,
        color: overlayStroke,
        fillColor: overlayFill,
        fillOpacity: DESIRED_AREA_FILL_OPACITY,
        weight: 2.5,
      }).addTo(map);
      bounds.extend(circle.getBounds());
    }

    for (const apartment of apartments) {
      const shown = apartment.displayScore ?? apartment.score;
      const color = markerColorForScore(shown, apartment.dealbreaker, "score");
      const marker = L.marker([apartment.latitude, apartment.longitude], {
        icon: markerIcon(color),
      }).addTo(map);

      bounds.extend([apartment.latitude, apartment.longitude]);

      const popupEl = document.createElement("div");
      const root = createRoot(popupEl);
      popupRootsRef.current.push(root);
      root.render(
        <PopupContent
          apartment={apartment}
          projectId={projectId}
          areaFilterMode={areaFilterMode}
        />
      );
      marker.bindPopup(popupEl);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      const roots = popupRootsRef.current;
      popupRootsRef.current = [];
      queueMicrotask(() => {
        for (const root of roots) {
          root.unmount();
        }
      });
    };
  }, [apartments, areaFilterPlzOverlays, areaFilterMode, projectId]);

  return (
    <div
      ref={containerRef}
      className="h-[min(50vh,480px)] min-h-[280px] sm:h-[480px] w-full rounded-xl overflow-hidden border border-pn-border z-0"
    />
  );
}
