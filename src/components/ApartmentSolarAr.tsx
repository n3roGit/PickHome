"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SolarSeasonDateControls } from "@/components/SolarSeasonDateControls";
import {
  azimuthSeparationDeg,
  computeHorizonLineInCanvas,
  intrinsicsFromFov,
  pitchDegFromHorizonMid,
  projectSunOnHorizonToCanvas,
  type HorizonLineSegment,
} from "@/lib/ar-horizon-line";
import {
  viewOrientationFromEvent,
  type GravitySample,
} from "@/lib/device-orientation-ar";
import {
  isGeolocationSupported,
  mapGeolocationError,
  queryGeolocationPermission,
  requestCurrentPosition,
  watchArPosition,
  type GeoPosition,
  type GeolocationArError,
} from "@/lib/geolocation-ar";
import {
  formatSolarTime,
  getSolarArc,
  type SolarSample,
} from "@/lib/solar-position";

/** Approximate phone camera FOV in portrait — short side (horizontal) is narrower than long side (vertical). */
const AR_FOV_DEG = 50;
const AR_VERTICAL_FOV_DEG = 65;
/** Hide suns clearly below the viewer horizon (tolerance for sensor noise) */
const AR_HORIZON_MARGIN_DEG = 12;
/** Per animation frame — lower = calmer compass overlay */
const HEADING_SMOOTH_PER_FRAME = 0.08;
const PITCH_SMOOTH_PER_FRAME = 0.1;
const MARKER_SMOOTH_PER_FRAME = 0.14;
const AR_DEBUG_LOG_INTERVAL_MS = 3000;
/** Break sun-path polyline when azimuth jumps (wrap or leaves FOV between samples). */
const SUN_PATH_AZIMUTH_GAP_DEG = 100;

type ProjectedSun = {
  sample: SolarSample;
  x: number;
  y: number;
  isNow: boolean;
};

type ArError =
  | "https_required"
  | "camera_denied"
  | "camera_unavailable"
  | "camera_busy"
  | "camera_unsupported"
  | "orientation_denied"
  | "orientation_unsupported"
  | GeolocationArError;

type Props = {
  backHref: string;
  title: string;
  timeZone: string;
  initialDayDate?: Date;
};

function isLocalHost(): boolean {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function isSecureContextForSensors(): boolean {
  return window.isSecureContext || isLocalHost();
}

function isLanHttp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.protocol === "https:") return false;
  const host = window.location.hostname;
  return !isLocalHost() && /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

async function queryCameraPermission(): Promise<PermissionState | "unknown"> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    return status.state;
  } catch {
    return "unknown";
  }
}

async function requestCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error("unsupported"), { code: "unsupported" });
  }
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: { facingMode: { ideal: "user" } }, audio: false },
    { video: true, audio: false },
  ];
  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      lastError = e;
      if (e instanceof DOMException && e.name === "NotAllowedError") break;
    }
  }
  throw lastError ?? new Error("unknown");
}

function mapStartError(err: unknown): ArError {
  if (err instanceof Error && (err as Error & { code?: string }).code === "unsupported") {
    return "camera_unsupported";
  }
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "camera_denied";
    if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
      return "camera_unavailable";
    }
    if (err.name === "NotReadableError" || err.name === "AbortError") return "camera_busy";
  }
  return "camera_denied";
}

function lerpAngleDeg(current: number, target: number, factor: number): number {
  const delta = ((target - current + 540) % 360) - 180;
  return (current + delta * factor + 360) % 360;
}

function lerpNumber(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

function smoothPoint(
  prev: { x: number; y: number } | undefined,
  target: { x: number; y: number },
  factor: number
): { x: number; y: number } {
  if (!prev) return target;
  return {
    x: prev.x + (target.x - prev.x) * factor,
    y: prev.y + (target.y - prev.y) * factor,
  };
}

function getScreenAngle(): number {
  return screen.orientation?.angle ?? (typeof window.orientation === "number" ? window.orientation : 0);
}

function readOrientation(
  e: DeviceOrientationEvent,
  gravity: GravitySample | null
): ReturnType<typeof viewOrientationFromEvent> {
  return viewOrientationFromEvent(e.alpha, e.beta, e.gamma, getScreenAngle(), gravity);
}

function horizonYFromPitch(pitch: number, h: number): number {
  return h / 2 + (pitch / AR_VERTICAL_FOV_DEG) * h;
}

function resolveHorizonLine(
  w: number,
  h: number,
  gravity: GravitySample | null,
  screenAngleDeg: number,
  pitch: number
): HorizonLineSegment {
  if (gravity) {
    const intrinsics = intrinsicsFromFov(w, h, AR_FOV_DEG, AR_VERTICAL_FOV_DEG);
    const fromGravity = computeHorizonLineInCanvas(
      w,
      h,
      intrinsics,
      gravity,
      screenAngleDeg
    );
    if (fromGravity) return fromGravity;
  }
  const y = horizonYFromPitch(pitch, h);
  return { x1: 0, y1: y, x2: w, y2: y };
}

function isSameCalendarDay(a: Date, b: Date, timeZone: string): boolean {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt(a) === fmt(b);
}

function isCurrentHour(sample: Date, now: Date, timeZone: string): boolean {
  if (!isSameCalendarDay(sample, now, timeZone)) return false;
  const hourFmt = (d: Date) =>
    d.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", hour12: false });
  return hourFmt(sample) === hourFmt(now);
}

export function ApartmentSolarAr({
  backHref,
  title,
  timeZone,
  initialDayDate,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const headingRef = useRef<number | null>(null);
  const pitchRef = useRef<number | null>(null);
  const flatRef = useRef(false);
  const gravityRef = useRef<GravitySample | null>(null);
  const smoothHeadingRef = useRef<number | null>(null);
  const smoothPitchRef = useRef<number | null>(null);
  const smoothHorizonRef = useRef<HorizonLineSegment | null>(null);
  const markerPosRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const rafRef = useRef<number | null>(null);
  const orientationCleanupRef = useRef<(() => void) | null>(null);
  const motionCleanupRef = useRef<(() => void) | null>(null);
  const geoWatchCleanupRef = useRef<(() => void) | null>(null);
  const sensorRef = useRef<{
    alpha: number;
    beta: number;
    gamma: number;
    absolute: boolean;
  } | null>(null);
  const lastArDebugLogMsRef = useRef(0);
  const arDebugRef = useRef(false);

  const [phase, setPhase] = useState<"idle" | "requesting" | "running" | "error">("idle");
  const [error, setError] = useState<ArError | null>(null);
  const [cameraPreDenied, setCameraPreDenied] = useState(false);
  const [locationPreDenied, setLocationPreDenied] = useState(false);
  const [dayDate, setDayDate] = useState(() => initialDayDate ?? new Date());
  const [livePosition, setLivePosition] = useState<GeoPosition | null>(null);

  const hourlySamples = useMemo(() => {
    if (!livePosition) return [];
    return getSolarArc(dayDate, livePosition.latitude, livePosition.longitude, 60);
  }, [dayDate, livePosition]);
  const sunlitHourly = useMemo(
    () => hourlySamples.filter((s) => s.isUp),
    [hourlySamples]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    arDebugRef.current =
      new URLSearchParams(window.location.search).get("ar_debug") === "1";
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    orientationCleanupRef.current?.();
    orientationCleanupRef.current = null;
    motionCleanupRef.current?.();
    motionCleanupRef.current = null;
    geoWatchCleanupRef.current?.();
    geoWatchCleanupRef.current = null;
    flatRef.current = false;
    gravityRef.current = null;
    smoothHeadingRef.current = null;
    smoothPitchRef.current = null;
    smoothHorizonRef.current = null;
    markerPosRef.current.clear();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setLivePosition(null);
  }, []);

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || phase !== "running") return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    const rawHeading = headingRef.current;
    const rawPitch = pitchRef.current;
    const now = new Date();

    if (flatRef.current) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText("Handy hochkant halten — flach auf dem Tisch keine AR-Sonnen", 16, 32);
      const dayLabel = dayDate.toLocaleDateString("de-DE", {
        timeZone,
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      });
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, h - 72, w, 72);
      ctx.fillStyle = "#fff";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(`Flach erkannt · ${sunlitHourly.length} h Sonne · ${dayLabel}`, 12, h - 44);
      ctx.fillText(
        "Rückkamera waagerecht zum Horizont richten, dann erscheinen Marken im Sichtfeld",
        12,
        h - 24
      );
      return;
    }

    if (rawHeading == null || rawPitch == null) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText("Kompass & Neigung werden kalibriert …", 16, 32);
      return;
    }

    let heading = smoothHeadingRef.current;
    if (heading == null) {
      heading = rawHeading;
    } else {
      heading = lerpAngleDeg(heading, rawHeading, HEADING_SMOOTH_PER_FRAME);
    }
    smoothHeadingRef.current = heading;

    let pitch = smoothPitchRef.current;
    if (pitch == null) {
      pitch = rawPitch;
    } else {
      pitch = lerpNumber(pitch, rawPitch, PITCH_SMOOTH_PER_FRAME);
    }
    smoothPitchRef.current = pitch;

    const rawHorizon = resolveHorizonLine(
      w,
      h,
      gravityRef.current,
      getScreenAngle(),
      pitch
    );
    let horizon = smoothHorizonRef.current;
    if (horizon == null) {
      horizon = rawHorizon;
    } else {
      horizon = {
        x1: horizon.x1,
        y1: lerpNumber(horizon.y1, rawHorizon.y1, PITCH_SMOOTH_PER_FRAME),
        x2: horizon.x2,
        y2: lerpNumber(horizon.y2, rawHorizon.y2, PITCH_SMOOTH_PER_FRAME),
      };
    }
    smoothHorizonRef.current = horizon;

    // Use pitch implied by the gravity horizon (stable near level); raw gravity atan2 jitters at ~0°.
    const pitchForSun =
      gravityRef.current != null
        ? pitchDegFromHorizonMid(horizon, h, AR_VERTICAL_FOV_DEG)
        : pitch;

    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(horizon.x1, horizon.y1);
    ctx.lineTo(horizon.x2, horizon.y2);
    ctx.stroke();

    if (sunlitHourly.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText("An diesem Datum keine Sonne über dem Horizont", 16, 32);
      return;
    }

    const projected: ProjectedSun[] = [];
    const activeKeys = new Set<number>();
    for (const sample of sunlitHourly) {
      const pos = projectSunOnHorizonToCanvas(
        w,
        h,
        horizon,
        sample.azimuthDeg,
        sample.altitudeDeg,
        heading,
        pitchForSun,
        AR_FOV_DEG,
        AR_VERTICAL_FOV_DEG,
        AR_HORIZON_MARGIN_DEG
      );
      if (!pos || pos.x < 0 || pos.x > w) continue;
      const key = sample.date.getTime();
      activeKeys.add(key);
      const smoothed = smoothPoint(
        markerPosRef.current.get(key),
        pos,
        MARKER_SMOOTH_PER_FRAME
      );
      markerPosRef.current.set(key, smoothed);
      projected.push({
        sample,
        x: smoothed.x,
        y: smoothed.y,
        isNow: isCurrentHour(sample.date, now, timeZone),
      });
    }
    for (const key of markerPosRef.current.keys()) {
      if (!activeKeys.has(key)) markerPosRef.current.delete(key);
    }

    const pathOnHorizon: { x: number; y: number; azimuthDeg: number; t: number }[] = [];
    for (const sample of sunlitHourly) {
      const pos = projectSunOnHorizonToCanvas(
        w,
        h,
        horizon,
        sample.azimuthDeg,
        0,
        heading,
        pitchForSun,
        AR_FOV_DEG,
        AR_VERTICAL_FOV_DEG,
        AR_HORIZON_MARGIN_DEG
      );
      if (!pos || pos.x < 0 || pos.x > w) continue;
      pathOnHorizon.push({
        x: pos.x,
        y: pos.y,
        azimuthDeg: sample.azimuthDeg,
        t: sample.date.getTime(),
      });
    }
    pathOnHorizon.sort((a, b) => a.t - b.t);

    if (pathOnHorizon.length > 1) {
      ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pathOnHorizon[0]!.x, pathOnHorizon[0]!.y);
      for (let i = 1; i < pathOnHorizon.length; i++) {
        const prev = pathOnHorizon[i - 1]!;
        const cur = pathOnHorizon[i]!;
        if (azimuthSeparationDeg(prev.azimuthDeg, cur.azimuthDeg) > SUN_PATH_AZIMUTH_GAP_DEG) {
          ctx.moveTo(cur.x, cur.y);
        } else {
          ctx.lineTo(cur.x, cur.y);
        }
      }
      ctx.stroke();
    }

    for (const { sample, x, y, isNow } of projected) {
      const r = isNow ? 14 : 9;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isNow ? "#f59e0b" : "rgba(245, 158, 11, 0.75)";
      ctx.fill();
      ctx.strokeStyle = isNow ? "#fff" : "rgba(255,255,255,0.7)";
      ctx.lineWidth = isNow ? 2 : 1;
      ctx.stroke();

      const label = formatSolarTime(sample.date, timeZone);
      ctx.font = isNow ? "bold 11px system-ui, sans-serif" : "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x, y - r - 6);
      ctx.textAlign = "left";
    }

    if (projected.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "14px system-ui, sans-serif";
      const hint =
        pitchForSun < -10
          ? "Blick zu weit nach unten — Handy hoch neigen"
          : pitchForSun > 50
            ? "Blick zu weit nach oben — Sonnen außerhalb des Sichtfelds"
            : "Handy drehen & neigen — stündliche Sonnen im Sichtfeld";
      ctx.fillText(hint, 16, 32);
    }

    const dayLabel = dayDate.toLocaleDateString("de-DE", {
      timeZone,
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, h - 72, w, 72);
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(
      `Heading ${heading.toFixed(0)}° · Neigung ${pitchForSun.toFixed(0)}° · ${sunlitHourly.length} h Sonne · ${dayLabel}`,
      12,
      h - 44
    );
    ctx.fillText(
      "Marken nur im Sichtfeld · große Marke = aktuelle Stunde (nur am heutigen Tag)",
      12,
      h - 24
    );

    if (arDebugRef.current && Date.now() - lastArDebugLogMsRef.current >= AR_DEBUG_LOG_INTERVAL_MS) {
      lastArDebugLogMsRef.current = Date.now();
      const nowSample = projected.find((p) => p.isNow) ?? projected[0];
      const horizonMidY = (horizon.y1 + horizon.y2) / 2;
      console.log(
        "[ph-ar] " +
          JSON.stringify({
            ts: new Date().toISOString(),
            flat: flatRef.current,
            heading: Math.round(heading * 10) / 10,
            pitch: Math.round(pitchForSun * 10) / 10,
            pitchSensor: Math.round(pitch * 10) / 10,
            rawHeading: rawHeading != null ? Math.round(rawHeading * 10) / 10 : null,
            rawPitch: rawPitch != null ? Math.round(rawPitch * 10) / 10 : null,
            sensor: sensorRef.current,
            gravity: gravityRef.current,
            screenAngleDeg: getScreenAngle(),
            canvas: { w, h },
            horizon: {
              y1: Math.round(horizon.y1),
              y2: Math.round(horizon.y2),
              mid: Math.round(horizonMidY),
            },
            geo: livePosition
              ? {
                  lat: Math.round(livePosition.latitude * 1e5) / 1e5,
                  lng: Math.round(livePosition.longitude * 1e5) / 1e5,
                }
              : null,
            sunNow: nowSample
              ? {
                  az: Math.round(nowSample.sample.azimuthDeg * 10) / 10,
                  alt: Math.round(nowSample.sample.altitudeDeg * 10) / 10,
                  x: Math.round(nowSample.x),
                  y: Math.round(nowSample.y),
                }
              : null,
            projectedCount: projected.length,
          })
      );
    }
  }, [phase, sunlitHourly, dayDate, timeZone, livePosition]);

  useEffect(() => {
    if (phase !== "running") return;
    const loop = () => {
      drawOverlay();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, drawOverlay]);

  useEffect(() => () => stop(), [stop]);

  async function start() {
    setError(null);
    setCameraPreDenied(false);
    setLocationPreDenied(false);
    if (!isSecureContextForSensors()) {
      setPhase("error");
      setError("https_required");
      return;
    }
    if (!("DeviceOrientationEvent" in window)) {
      setPhase("error");
      setError("orientation_unsupported");
      return;
    }
    if (!isGeolocationSupported()) {
      setPhase("error");
      setError("location_unsupported");
      return;
    }

    setPhase("requesting");
    try {
      const OrientationCtor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<PermissionState>;
      };
      if (typeof OrientationCtor.requestPermission === "function") {
        const perm = await OrientationCtor.requestPermission();
        if (perm !== "granted") {
          setPhase("error");
          setError("orientation_denied");
          return;
        }
      }

      const locationPerm = await queryGeolocationPermission();
      if (locationPerm === "denied") {
        setPhase("error");
        setLocationPreDenied(true);
        setError("location_denied");
        return;
      }

      const initialPosition = await requestCurrentPosition();
      setLivePosition(initialPosition);

      const cameraPerm = await queryCameraPermission();
      if (cameraPerm === "denied") {
        setPhase("error");
        setCameraPreDenied(true);
        setError("camera_denied");
        return;
      }

      const stream = await requestCameraStream();
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          /* stream attached; iOS may still show frames */
        }
      }

      geoWatchCleanupRef.current = watchArPosition(
        (position) => setLivePosition(position),
        () => {
          /* keep last known position while AR is running */
        }
      );

      const onDeviceMotion = (e: DeviceMotionEvent) => {
        const g = e.accelerationIncludingGravity;
        if (!g || g.x == null || g.y == null || g.z == null) return;
        gravityRef.current = { x: g.x, y: g.y, z: g.z };
      };
      window.addEventListener("devicemotion", onDeviceMotion, true);
      motionCleanupRef.current = () => {
        window.removeEventListener("devicemotion", onDeviceMotion, true);
      };

      const supportsAbsoluteOrientation = "ondeviceorientationabsolute" in window;

      const onOrientation = (e: DeviceOrientationEvent) => {
        if (supportsAbsoluteOrientation && e.absolute !== true) return;
        if (
          e.alpha != null &&
          e.beta != null &&
          e.gamma != null &&
          !Number.isNaN(e.alpha) &&
          !Number.isNaN(e.beta) &&
          !Number.isNaN(e.gamma)
        ) {
          sensorRef.current = {
            alpha: e.alpha,
            beta: e.beta,
            gamma: e.gamma,
            absolute: e.absolute === true,
          };
        }
        const view = readOrientation(e, gravityRef.current);
        if (!view) return;
        if (view.flat) {
          flatRef.current = true;
          headingRef.current = null;
          pitchRef.current = null;
          smoothHeadingRef.current = null;
          smoothPitchRef.current = null;
          smoothHorizonRef.current = null;
          markerPosRef.current.clear();
          return;
        }
        flatRef.current = false;
        if (view.heading == null || view.pitch == null) return;
        headingRef.current = view.heading;
        pitchRef.current = view.pitch;
      };

      if (supportsAbsoluteOrientation) {
        window.addEventListener("deviceorientationabsolute", onOrientation, true);
      } else {
        window.addEventListener("deviceorientation", onOrientation, true);
      }
      orientationCleanupRef.current = () => {
        if (supportsAbsoluteOrientation) {
          window.removeEventListener("deviceorientationabsolute", onOrientation, true);
        } else {
          window.removeEventListener("deviceorientation", onOrientation, true);
        }
      };

      setPhase("running");
    } catch (e) {
      stop();
      setPhase("error");
      if (e instanceof GeolocationPositionError) {
        if (e.code === e.PERMISSION_DENIED) setLocationPreDenied(true);
        setError(mapGeolocationError(e));
        return;
      }
      setError(mapStartError(e));
    }
  }

  const errorMessages: Record<ArError, string> = {
    https_required: isLanHttp()
      ? "Über http://192.168… vom Handy aus funktionieren Kamera, Kompass und GPS oft nicht. Am PC localhost nutzen oder PickHome hinter HTTPS (z. B. Reverse-Proxy) bereitstellen."
      : "Kamera, Kompass und Standort benötigen HTTPS (oder localhost). Bitte PickHome über TLS oder lokal am Rechner testen.",
    camera_denied: cameraPreDenied
      ? "Die Kamera ist für diese Seite blockiert — deshalb erscheint oft kein Dialog. Chrome/Edge: Schloss-Symbol in der Adresszeile → Website-Einstellungen → Kamera auf „Zulassen“, dann Seite neu laden (Strg+F5). Windows: Einstellungen → Datenschutz → Kamera → Zugriff für Desktop-Apps erlauben."
      : "Kamerazugriff wurde verweigert. In den Browser-Einstellungen für diese Seite die Kamera erlauben und erneut versuchen.",
    camera_unavailable:
      "Keine Kamera gefunden oder gewünschte Rückkamera nicht verfügbar.",
    camera_busy:
      "Kamera wird bereits von einer anderen App genutzt (z. B. Videoanruf).",
    camera_unsupported: "Kamera-API wird in diesem Browser nicht unterstützt.",
    orientation_denied: "Kompass-/Bewegungssensor wurde verweigert.",
    orientation_unsupported: "Kompass wird in diesem Browser nicht unterstützt.",
    location_denied: locationPreDenied
      ? "Der Standort ist für diese Seite blockiert — deshalb erscheint oft kein Dialog. Chrome/Edge: Schloss-Symbol → Website-Einstellungen → Standort auf „Zulassen“, dann Seite neu laden."
      : "Standortzugriff wurde verweigert. AR nutzt deine aktuelle GPS-Position — bitte in den Browser-Einstellungen erlauben und erneut versuchen.",
    location_unavailable:
      "Aktuelle Position konnte nicht ermittelt werden (GPS aus oder kein Empfang).",
    location_timeout: "Standortabfrage hat zu lange gedauert — bitte erneut versuchen.",
    location_unsupported: "Standort-API wird in diesem Browser nicht unterstützt.",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between gap-2 p-3 pb-2">
          <Link href={backHref} className="text-sm text-white/90 hover:underline shrink-0">
            ← Zurück
          </Link>
          <p className="text-sm truncate opacity-90">{title}</p>
        </div>
        <div className="px-3 pb-3 max-w-md">
          <SolarSeasonDateControls
            dayDate={dayDate}
            onDayDateChange={setDayDate}
            variant="dark"
            showDateLabel={false}
          />
        </div>
      </div>

      {phase === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <p className="text-center text-sm text-white/80 max-w-sm">
            Live-Kamera mit stündlichen Sonnenmarken für deinen aktuellen Standort
            und das gewählte Datum (oben einstellbar). Sichtbar nur bei passender
            Blickrichtung und Neigung.
          </p>
          {isLanHttp() && (
            <p className="text-center text-sm text-amber-200/90 max-w-sm">
              Du erreichst PickHome über die LAN-IP ohne HTTPS — Kamera und GPS
              blockiert das oft. Am Handy nur mit HTTPS testen.
            </p>
          )}
          <button
            type="button"
            data-testid="solar-ar-start"
            onClick={() => void start()}
            className="bg-pn-accent text-white font-semibold px-6 py-3 rounded-lg text-sm min-h-[44px]"
          >
            Kamera, Kompass & Standort starten
          </button>
        </div>
      )}

      {phase === "requesting" && (
        <div className="flex-1 flex items-center justify-center text-sm">Berechtigungen …</div>
      )}

      {phase === "error" && error && (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-4 p-6"
          data-testid="solar-ar-error"
        >
          <p className="text-center text-sm max-w-sm whitespace-pre-line">{errorMessages[error]}</p>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="text-sm underline"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {(phase === "running" || phase === "requesting") && (
        <>
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            data-testid={phase === "running" ? "solar-ar-running" : undefined}
          />
        </>
      )}

    </div>
  );
}
