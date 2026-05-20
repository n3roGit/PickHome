"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { ScoreBadge } from "@/components/ScoreBadge";
import { markerColorForScore } from "@/lib/scoring";
import type { MappedApartment } from "@/components/ProjectMap";

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
}: {
  projectId: string;
  apartments: MappedApartment[];
  colorMode: "score" | "dealbreaker";
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
