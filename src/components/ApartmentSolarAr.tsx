"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SolarSeasonDateControls } from "@/components/SolarSeasonDateControls";
import {
  mergePitchReadings,
  pitchFromGravity,
  pitchFromOrientation,
} from "@/lib/device-pitch";
import {
  formatSolarTime,
  getSolarArc,
  type SolarSample,
} from "@/lib/solar-position";

const AR_FOV_DEG = 60;
const AR_VERTICAL_FOV_DEG = 60;
/** Hide suns clearly below the viewer horizon (tolerance for sensor noise) */
const AR_HORIZON_MARGIN_DEG = 12;
/** Per animation frame — lower = calmer compass overlay */
const HEADING_SMOOTH_PER_FRAME = 0.08;
const PITCH_SMOOTH_PER_FRAME = 0.1;
const MARKER_SMOOTH_PER_FRAME = 0.14;

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
  | "orientation_unsupported";

type Props = {
  backHref: string;
  title: string;
  latitude: number;
  longitude: number;
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

function readHeading(e: DeviceOrientationEvent): number | null {
  const ios = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
  if (typeof ios.webkitCompassHeading === "number" && !Number.isNaN(ios.webkitCompassHeading)) {
    return ios.webkitCompassHeading;
  }
  if (e.absolute && e.alpha != null && !Number.isNaN(e.alpha)) {
    return (360 - e.alpha) % 360;
  }
  if (e.alpha != null && !Number.isNaN(e.alpha)) {
    return (360 - e.alpha) % 360;
  }
  return null;
}

function horizonYFromPitch(pitch: number, h: number): number {
  return h / 2 + (pitch / AR_VERTICAL_FOV_DEG) * (h / 2);
}

function projectSun(
  sample: SolarSample,
  heading: number,
  pitch: number,
  w: number,
  h: number
): { x: number; y: number } | null {
  if (!sample.isUp) return null;
  const relAlt = sample.altitudeDeg - pitch;
  if (relAlt < -AR_HORIZON_MARGIN_DEG) return null;
  if (relAlt > AR_VERTICAL_FOV_DEG / 2) return null;

  const delta = ((sample.azimuthDeg - heading + 540) % 360) - 180;
  if (Math.abs(delta) > AR_FOV_DEG / 2 + 5) return null;

  const x = w / 2 + (delta / AR_FOV_DEG) * w;
  const y = h / 2 - (relAlt / AR_VERTICAL_FOV_DEG) * h;
  if (x < -20 || x > w + 20 || y < -20 || y > h + 20) return null;
  return { x, y };
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
  latitude,
  longitude,
  timeZone,
  initialDayDate,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const headingRef = useRef<number | null>(null);
  const pitchRef = useRef<number | null>(null);
  const gravityPitchRef = useRef<number | null>(null);
  const smoothHeadingRef = useRef<number | null>(null);
  const smoothPitchRef = useRef<number | null>(null);
  const markerPosRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const rafRef = useRef<number | null>(null);
  const orientationCleanupRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<"idle" | "requesting" | "running" | "error">("idle");
  const [error, setError] = useState<ArError | null>(null);
  const [cameraPreDenied, setCameraPreDenied] = useState(false);
  const [dayDate, setDayDate] = useState(() => initialDayDate ?? new Date());

  const hourlySamples = useMemo(
    () => getSolarArc(dayDate, latitude, longitude, 60),
    [dayDate, latitude, longitude]
  );
  const sunlitHourly = useMemo(
    () => hourlySamples.filter((s) => s.isUp),
    [hourlySamples]
  );

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    orientationCleanupRef.current?.();
    orientationCleanupRef.current = null;
    smoothHeadingRef.current = null;
    smoothPitchRef.current = null;
    gravityPitchRef.current = null;
    markerPosRef.current.clear();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
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

    const horizonY = horizonYFromPitch(pitch, h);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(w, horizonY);
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
      const pos = projectSun(sample, heading, pitch, w, h);
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

    if (projected.length > 0) {
      ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sorted = [...projected].sort((a, b) => a.x - b.x);
      ctx.moveTo(sorted[0]!.x, sorted[0]!.y);
      for (let i = 1; i < sorted.length; i++) {
        ctx.lineTo(sorted[i]!.x, sorted[i]!.y);
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
        pitch < -10
          ? "Blick zu weit nach unten — Handy hoch neigen"
          : pitch > 50
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
      `Heading ${heading.toFixed(0)}° · Neigung ${pitch.toFixed(0)}° · ${sunlitHourly.length} h Sonne · ${dayLabel}`,
      12,
      h - 44
    );
    ctx.fillText(
      "Marken nur im Sichtfeld · große Marke = aktuelle Stunde (nur am heutigen Tag)",
      12,
      h - 24
    );
  }, [phase, sunlitHourly, dayDate, timeZone]);

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

      const onOrientation = (e: DeviceOrientationEvent) => {
        const h = readHeading(e);
        if (h != null) headingRef.current = h;
        const oriPitch = pitchFromOrientation(e.beta, e.gamma, getScreenAngle());
        const merged = mergePitchReadings(oriPitch, gravityPitchRef.current);
        if (merged != null) pitchRef.current = merged;
      };

      const onMotion = (e: DeviceMotionEvent) => {
        const acc = e.accelerationIncludingGravity;
        if (!acc || acc.x == null || acc.y == null || acc.z == null) return;
        gravityPitchRef.current = pitchFromGravity(acc.x, acc.y, acc.z, getScreenAngle());
      };

      window.addEventListener("deviceorientationabsolute", onOrientation, true);
      window.addEventListener("deviceorientation", onOrientation, true);
      if ("DeviceMotionEvent" in window) {
        window.addEventListener("devicemotion", onMotion, true);
      }
      orientationCleanupRef.current = () => {
        window.removeEventListener("deviceorientationabsolute", onOrientation, true);
        window.removeEventListener("deviceorientation", onOrientation, true);
        window.removeEventListener("devicemotion", onMotion, true);
      };

      setPhase("running");
    } catch (e) {
      stop();
      setPhase("error");
      setError(mapStartError(e));
    }
  }

  const errorMessages: Record<ArError, string> = {
    https_required: isLanHttp()
      ? "Über http://192.168… vom Handy aus funktioniert die Kamera nicht. Am PC localhost nutzen oder PickHome hinter HTTPS (z. B. Reverse-Proxy) bereitstellen."
      : "Kamera und Kompass benötigen HTTPS (oder localhost). Bitte PickHome über TLS oder lokal am Rechner testen.",
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
            Live-Kamera mit stündlichen Sonnenmarken für das gewählte Datum (oben
            einstellbar). Sichtbar nur bei passender Blickrichtung und Neigung.
          </p>
          {isLanHttp() && (
            <p className="text-center text-sm text-amber-200/90 max-w-sm">
              Du erreichst PickHome über die LAN-IP ohne HTTPS — die Kamera blockiert das oft.
              Am Handy nur mit HTTPS testen.
            </p>
          )}
          <button
            type="button"
            data-testid="solar-ar-start"
            onClick={() => void start()}
            className="bg-pn-accent text-white font-semibold px-6 py-3 rounded-lg text-sm min-h-[44px]"
          >
            Kamera + Kompass starten
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
