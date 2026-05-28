"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PoiCategoryLegend } from "@/components/PoiCategoryLegend";
import {
  markersForMap,
  osmLinkForPoi,
  POI_CATEGORY_COLORS,
  POI_CATEGORY_LABELS,
  countPoisByCategory,
  type OverpassPoiData,
  type PoiCategoryId,
  type PoiMarker,
} from "@/lib/overpass-poi";

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ESRI_IMAGERY_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

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

function poiIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:10px;height:10px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

function apartmentIcon() {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function popupHtml(marker: PoiMarker): string {
  const name = marker.name ?? "Unbenannt";
  const label = POI_CATEGORY_LABELS[marker.categoryId];
  const link = osmLinkForPoi(marker);
  return `<div class="text-sm leading-snug">
    <p class="font-semibold m-0">${escapeHtml(name)}</p>
    <p class="text-xs mt-1 m-0 opacity-80">${escapeHtml(label)} · ${marker.distanceM} m</p>
    <a href="${link}" target="_blank" rel="noreferrer" class="text-xs mt-1 inline-block">OSM ↗</a>
  </div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function OverpassPoiMapInner({
  latitude,
  longitude,
  data,
}: {
  latitude: number;
  longitude: number;
  data: OverpassPoiData;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const poiLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusLayerRef = useRef<L.LayerGroup | null>(null);

  const allMarkers = useMemo(() => markersForMap(data), [data]);
  const [hiddenCategories, setHiddenCategories] = useState<Set<PoiCategoryId>>(() => new Set());

  const visibleMarkers = useMemo(
    () => allMarkers.filter((m) => !hiddenCategories.has(m.categoryId)),
    [allMarkers, hiddenCategories]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { scrollWheelZoom: true }).setView([latitude, longitude], 15);
    mapRef.current = map;

    const { osm, satellite } = createBaseLayers();
    osm.addTo(map);
    L.control
      .layers(
        {
          Karte: osm,
          Luftbild: satellite,
        },
        {},
        { position: "topright" }
      )
      .addTo(map);

    const radiusLayer = L.layerGroup().addTo(map);
    radiusLayerRef.current = radiusLayer;

    L.circle([latitude, longitude], {
      radius: data.radii.wider,
      color: "#94a3b8",
      weight: 1,
      fill: false,
      dashArray: "4 6",
    }).addTo(radiusLayer);

    L.circle([latitude, longitude], {
      radius: data.radii.close,
      color: "#64748b",
      weight: 1,
      fill: false,
      dashArray: "2 4",
    }).addTo(radiusLayer);

    L.marker([latitude, longitude], { icon: apartmentIcon(), zIndexOffset: 1000 })
      .bindTooltip("Wohnung", { direction: "top", offset: [0, -8] })
      .addTo(map);

    const poiLayer = L.layerGroup().addTo(map);
    poiLayerRef.current = poiLayer;

    const bounds = L.latLngBounds([[latitude, longitude]]);
    for (const marker of allMarkers) {
      bounds.extend([marker.lat, marker.lng]);
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.12), { maxZoom: 16 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      poiLayerRef.current = null;
      radiusLayerRef.current = null;
    };
  }, [latitude, longitude, data.radii.close, data.radii.wider]);

  useEffect(() => {
    const map = mapRef.current;
    const poiLayer = poiLayerRef.current;
    if (!map || !poiLayer) return;

    poiLayer.clearLayers();
    for (const marker of visibleMarkers) {
      const color = POI_CATEGORY_COLORS[marker.categoryId];
      L.marker([marker.lat, marker.lng], { icon: poiIcon(color) })
        .bindPopup(popupHtml(marker), { maxWidth: 260 })
        .addTo(poiLayer);
    }
  }, [visibleMarkers]);

  function toggleCategory(id: PoiCategoryId) {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        data-testid="overpass-poi-map"
        className="h-[320px] sm:h-[400px] w-full rounded-xl overflow-hidden border border-pn-border z-0"
      />
      <PoiCategoryLegend
        counts={countPoisByCategory(allMarkers)}
        hiddenCategories={hiddenCategories}
        onToggleCategory={toggleCategory}
        footer={`Kreise: ${data.radii.close} m / ${data.radii.wider} m · ${visibleMarkers.length} von ${allMarkers.length} POIs sichtbar`}
      />
    </div>
  );
}
