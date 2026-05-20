"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import type { MapApartment } from "@/components/ProjectMap";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function ProjectMapInner({
  apartments,
}: {
  apartments: (MapApartment & { latitude: number; longitude: number })[];
}) {
  const center = apartments[0];

  return (
    <div className="h-[min(50vh,480px)] min-h-[280px] sm:h-[480px] w-full rounded-xl overflow-hidden border border-pn-border z-0">
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={11}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {apartments.map((a) => (
          <Marker key={a.id} position={[a.latitude, a.longitude]} icon={icon}>
            <Popup>
              <p className="font-semibold text-sm">{a.title}</p>
              {a.address && <p className="text-xs mt-1">{a.address}</p>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
