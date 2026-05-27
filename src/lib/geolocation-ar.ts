export type GeoPosition = {
  latitude: number;
  longitude: number;
};

export type GeolocationArError =
  | "location_denied"
  | "location_unavailable"
  | "location_timeout"
  | "location_unsupported";

const DEFAULT_GET_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
};

const DEFAULT_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 5_000,
};

export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export async function queryGeolocationPermission(): Promise<PermissionState | "unknown"> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown";
  }
}

export function requestCurrentPosition(
  options: PositionOptions = DEFAULT_GET_OPTIONS
): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      reject,
      options
    );
  });
}

export function watchArPosition(
  onUpdate: (position: GeoPosition) => void,
  onError?: (error: GeolocationPositionError) => void,
  options: PositionOptions = DEFAULT_WATCH_OPTIONS
): () => void {
  const watchId = navigator.geolocation.watchPosition(
    (pos) =>
      onUpdate({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
    onError,
    options
  );
  return () => navigator.geolocation.clearWatch(watchId);
}

export function mapGeolocationError(error: GeolocationPositionError): GeolocationArError {
  if (error.code === error.PERMISSION_DENIED) return "location_denied";
  if (error.code === error.TIMEOUT) return "location_timeout";
  return "location_unavailable";
}
