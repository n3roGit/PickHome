"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  destinationPoint,
  getSolarArc,
  getSolarSample,
} from "@/lib/solar-position";

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ARC_DISTANCE_M = 300;

function createOsmLayer() {
  return L.tileLayer(OSM_TILE_URL, {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
}

function sunIcon() {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function ApartmentSunMapInner({
  latitude,
  longitude,
  selectedDate,
}: {
  latitude: number;
  longitude: number;
  selectedDate: Date;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    arc: L.Polyline | null;
    ray: L.Polyline | null;
    marker: L.Marker | null;
    apt: L.Marker | null;
  }>({ arc: null, ray: null, marker: null, apt: null });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { scrollWheelZoom: true }).setView([latitude, longitude], 17);
    mapRef.current = map;
    createOsmLayer().addTo(map);

    const aptMarker = L.marker([latitude, longitude], {
      icon: L.divIcon({
        className: "",
        html: `<span style="display:block;width:12px;height:12px;border-radius:50%;background:#3b82f6;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
    }).addTo(map);
    layersRef.current.apt = aptMarker;

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = { arc: null, ray: null, marker: null, apt: null };
    };
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const { arc, ray, marker } = layersRef.current;
    if (arc) map.removeLayer(arc);
    if (ray) map.removeLayer(ray);
    if (marker) map.removeLayer(marker);

    const arcPoints: L.LatLngExpression[] = [];
    for (const sample of getSolarArc(selectedDate, latitude, longitude, 30)) {
      if (sample.altitudeDeg <= 0) continue;
      const end = destinationPoint(latitude, longitude, sample.azimuthDeg, ARC_DISTANCE_M);
      arcPoints.push([end.lat, end.lng]);
    }

    let newArc: L.Polyline | null = null;
    if (arcPoints.length >= 2) {
      newArc = L.polyline(arcPoints, {
        color: "#f59e0b",
        weight: 3,
        opacity: 0.85,
      }).addTo(map);
    }

    const current = getSolarSample(selectedDate, latitude, longitude);
    let newRay: L.Polyline | null = null;
    let newMarker: L.Marker | null = null;
    if (current.isUp) {
      const end = destinationPoint(latitude, longitude, current.azimuthDeg, ARC_DISTANCE_M);
      newRay = L.polyline(
        [
          [latitude, longitude],
          [end.lat, end.lng],
        ],
        { color: "#ea580c", weight: 4, opacity: 1 }
      ).addTo(map);
      newMarker = L.marker([end.lat, end.lng], { icon: sunIcon() }).addTo(map);
    }

    layersRef.current.arc = newArc;
    layersRef.current.ray = newRay;
    layersRef.current.marker = newMarker;
  }, [latitude, longitude, selectedDate]);

  return (
    <div
      ref={containerRef}
      className="h-[320px] sm:h-[420px] w-full rounded-xl overflow-hidden border border-pn-border z-0"
    />
  );
}
