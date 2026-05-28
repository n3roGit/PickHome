import { fetchExternal, type FetchExternalOptions } from "@/lib/external-fetch";

export type ArcGisIdentifyHit = {
  layerId?: number;
  layerName?: string;
  value?: string;
  displayFieldName?: string;
  attributes?: Record<string, unknown>;
};

export type ArcGisIdentifyOptions = {
  mapServerUrl: string;
  latitude: number;
  longitude: number;
  service: "boris" | "noise";
  sr?: "4326" | "3857";
  tolerance?: number;
  extentPad?: number;
  layers?: string;
  headers?: HeadersInit;
  fetchOptions?: FetchExternalOptions;
};

function buildIdentifyUrl(options: ArcGisIdentifyOptions): string {
  const pad = options.extentPad ?? 0.015;
  const lon = options.longitude;
  const lat = options.latitude;
  const sr = options.sr ?? "4326";

  const params = new URLSearchParams({
    f: "json",
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    sr,
    layers: options.layers ?? "all",
    tolerance: String(options.tolerance ?? 8),
    mapExtent: [lon - pad, lat - pad, lon + pad, lat + pad].join(","),
    imageDisplay: "800,600,96",
    returnGeometry: "false",
  });

  const base = options.mapServerUrl.replace(/\/$/, "");
  return `${base}/identify?${params}`;
}

export async function fetchArcGisIdentify(
  options: ArcGisIdentifyOptions
): Promise<
  | { ok: true; results: ArcGisIdentifyHit[] }
  | { ok: false; error: string }
> {
  if (!Number.isFinite(options.latitude) || !Number.isFinite(options.longitude)) {
    return { ok: false, error: "invalid_coords" };
  }

  const url = buildIdentifyUrl(options);
  const res = await fetchExternal(options.service, url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PickHome/1.0 (arcgis identify; self-hosted)",
      ...options.headers,
    },
    signal: AbortSignal.timeout(30_000),
  }, options.fetchOptions);

  if (!res) {
    return { ok: false, error: "fetch_failed" };
  }

  if (!res.ok) {
    return { ok: false, error: `http_${res.status}` };
  }

  let payload: { results?: ArcGisIdentifyHit[]; error?: { message?: string } };
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  if (payload.error?.message) {
    return { ok: false, error: payload.error.message };
  }

  return { ok: true, results: payload.results ?? [] };
}

export function attrString(
  attrs: Record<string, unknown> | undefined,
  ...keys: string[]
): string | null {
  if (!attrs) return null;
  for (const key of keys) {
    const v = attrs[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}
