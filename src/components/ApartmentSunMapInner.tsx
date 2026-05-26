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
const ESRI_IMAGERY_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
/** Target screen radius for sun-direction rays; scales with zoom via map projection. */
const ARC_TARGET_PIXELS = 110;
const ARC_DISTANCE_MIN_M = 40;
const ARC_DISTANCE_MAX_M = 2500;

function arcDistanceMeters(map: L.Map, lat: number, lng: number): number {
  const center = L.latLng(lat, lng);
  const centerPx = map.latLngToContainerPoint(center);
  const edgePx = L.point(centerPx.x + ARC_TARGET_PIXELS, centerPx.y);
  const edge = map.containerPointToLatLng(edgePx);
  const meters = map.distance(center, edge);
  return Math.min(ARC_DISTANCE_MAX_M, Math.max(ARC_DISTANCE_MIN_M, meters));
}

function createBaseLayers() {
  const osm = L.tileLayer(OSM_TILE_URL, {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
  const satellite = L.tileLayer(ESRI_IMAGERY_TILE_URL, {
    maxZoom: 19,
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
  });
  return { osm, satellite };
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

    const { osm, satellite } = createBaseLayers();
    osm.addTo(map);
    L.control
      .layers(
        {
          OpenStreetMap: osm,
          Luftbild: satellite,
        },
        {},
        { position: "topright" }
      )
      .addTo(map);

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

    function redrawSunLayers() {
      const activeMap = mapRef.current;
      if (!activeMap) return;

      const { arc, ray, marker } = layersRef.current;
      if (arc) activeMap.removeLayer(arc);
      if (ray) activeMap.removeLayer(ray);
      if (marker) activeMap.removeLayer(marker);

      const distanceM = arcDistanceMeters(activeMap, latitude, longitude);
      const arcPoints: L.LatLngExpression[] = [];
      for (const sample of getSolarArc(selectedDate, latitude, longitude, 30)) {
        if (sample.altitudeDeg <= 0) continue;
        const end = destinationPoint(latitude, longitude, sample.azimuthDeg, distanceM);
        arcPoints.push([end.lat, end.lng]);
      }

      let newArc: L.Polyline | null = null;
      if (arcPoints.length >= 2) {
        newArc = L.polyline(arcPoints, {
          color: "#f59e0b",
          weight: 3,
          opacity: 0.85,
        }).addTo(activeMap);
      }

      const current = getSolarSample(selectedDate, latitude, longitude);
      let newRay: L.Polyline | null = null;
      let newMarker: L.Marker | null = null;
      if (current.isUp) {
        const end = destinationPoint(latitude, longitude, current.azimuthDeg, distanceM);
        newRay = L.polyline(
          [
            [latitude, longitude],
            [end.lat, end.lng],
          ],
          { color: "#ea580c", weight: 4, opacity: 1 }
        ).addTo(activeMap);
        newMarker = L.marker([end.lat, end.lng], { icon: sunIcon() }).addTo(activeMap);
      }

      layersRef.current.arc = newArc;
      layersRef.current.ray = newRay;
      layersRef.current.marker = newMarker;
    }

    redrawSunLayers();
    map.on("zoomend zoom", redrawSunLayers);

    return () => {
      map.off("zoomend zoom", redrawSunLayers);
    };
  }, [latitude, longitude, selectedDate]);

  return (
    <div
      ref={containerRef}
      className="h-[320px] sm:h-[420px] w-full rounded-xl overflow-hidden border border-pn-border z-0"
    />
  );
}
