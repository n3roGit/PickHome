"use client";

import { useEffect, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { ScoreBadge } from "@/components/ScoreBadge";
import { DesiredAreaBadge } from "@/components/DesiredAreaBadge";
import { markerColorForScore } from "@/lib/scoring";
import type { MappedApartment, PlzMapOverlay } from "@/components/ProjectMap";

const DESIRED_AREA_FILL = "rgba(34, 197, 94, 0.18)";
const DESIRED_AREA_STROKE = "rgba(22, 163, 74, 0.55)";

function markerIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function ProjectMapInner({
  projectId,
  apartments,
  colorMode,
  areaFilterPlzOverlays,
}: {
  projectId: string;
  apartments: MappedApartment[];
  colorMode: "score" | "dealbreaker";
  areaFilterPlzOverlays: PlzMapOverlay[];
}) {
  const center = apartments[0];
  const [containerId, setContainerId] = useState<string | null>(null);

  useEffect(() => {
    setContainerId(`ph-map-${crypto.randomUUID()}`);
    return () => setContainerId(null);
  }, []);

  if (!containerId) {
    return (
      <div className="h-[min(50vh,480px)] min-h-[280px] sm:h-[480px] w-full rounded-xl border border-pn-border bg-pn-bg-subtle" />
    );
  }

  return (
    <div className="h-[min(50vh,480px)] min-h-[280px] sm:h-[480px] w-full rounded-xl overflow-hidden border border-pn-border z-0">
      <MapContainer
        id={containerId}
        center={[center.latitude, center.longitude]}
        zoom={11}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {areaFilterPlzOverlays.map((entry) => (
          <Circle
            key={entry.plz}
            center={[entry.lat, entry.lng]}
            radius={1800}
            pathOptions={{
              color: DESIRED_AREA_STROKE,
              fillColor: DESIRED_AREA_FILL,
              fillOpacity: 1,
              weight: 2,
            }}
          />
        ))}
        {apartments.map((a) => {
          const shown = a.displayScore ?? a.score;
          const color = markerColorForScore(shown, a.dealbreaker, colorMode);
          return (
            <Marker
              key={a.id}
              position={[a.latitude, a.longitude]}
              icon={markerIcon(color)}
            >
              <Popup>
                <p className="font-semibold text-sm">{a.title}</p>
                {a.address && <p className="text-xs mt-1">{a.address}</p>}
                {a.areaMatchStatus && a.areaMatchStatus !== "unset" && (
                  <div className="mt-1">
                    <DesiredAreaBadge status={a.areaMatchStatus} />
                  </div>
                )}
                <div className="mt-2">
                  <ScoreBadge
                    score={a.score}
                    displayScore={a.displayScore}
                    dealbreaker={a.dealbreaker}
                  />
                </div>
                <Link
                  href={`/project/${projectId}/apartment/${a.id}`}
                  className="text-xs text-pn-accent hover:underline mt-2 inline-block"
                >
                  Details öffnen
                </Link>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
