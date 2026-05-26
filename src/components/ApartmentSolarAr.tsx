"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  compassFromAzimuth,
  dateAtMinutesOnDay,
  formatSolarTime,
  getSolarSample,
  minutesFromDate,
} from "@/lib/solar-position";

type ArError = "https_required" | "camera_denied" | "orientation_denied" | "orientation_unsupported";

type Props = {
  backHref: string;
  title: string;
  latitude: number;
  longitude: number;
  timeZone: string;
};

function isLocalHost(): boolean {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function isSecureContextForSensors(): boolean {
  return window.isSecureContext || isLocalHost();
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

export function ApartmentSolarAr({ backHref, title, latitude, longitude, timeZone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const headingRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const orientationCleanupRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<"idle" | "requesting" | "running" | "error">("idle");
  const [error, setError] = useState<ArError | null>(null);
  const [dayDate, setDayDate] = useState(() => new Date());
  const [minutes, setMinutes] = useState(() => minutesFromDate(new Date()));
  const [showControls, setShowControls] = useState(false);

  const selectedDate = dateAtMinutesOnDay(dayDate, minutes);
  const sample = getSolarSample(selectedDate, latitude, longitude);

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    orientationCleanupRef.current?.();
    orientationCleanupRef.current = null;
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
    const horizonY = h * 0.55;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(w, horizonY);
    ctx.stroke();

    const heading = headingRef.current;
    const fov = 60;
    const sunAz = sample.azimuthDeg;
    const sunAlt = sample.altitudeDeg;

    if (heading == null) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText("Kompass wird kalibriert …", 16, 32);
      return;
    }

    if (!sample.isUp) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText("Sonne unter Horizont zur gewählten Zeit", 16, 32);
      return;
    }

    const delta = ((sunAz - heading + 540) % 360) - 180;
    const x = w / 2 + (delta / fov) * w;
    const y = horizonY - Math.sin((sunAlt * Math.PI) / 180) * (h * 0.35);

    if (x >= 0 && x <= w) {
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const arrowX = x < 0 ? 24 : w - 24;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(x < 0 ? "←" : "→", arrowX, horizonY - 8);
      ctx.textAlign = "left";
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillText("Handy drehen", arrowX - (x < 0 ? 0 : 40), horizonY + 20);
    }

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, h - 72, w, 72);
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(
      `Heading ${heading.toFixed(0)}° · Sonne ${compassFromAzimuth(sunAz)} ${sunAz.toFixed(0)}° · ${sunAlt.toFixed(0)}° · ${formatSolarTime(selectedDate, timeZone)}`,
      12,
      h - 44
    );
    ctx.fillText(
      "Kompass kann ungenau sein. Vom Magnetfeld weghalten, Handy in Achterform bewegen.",
      12,
      h - 24
    );
  }, [phase, sample, selectedDate, timeZone]);

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

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      const onOrientation = (e: DeviceOrientationEvent) => {
        const h = readHeading(e);
        if (h != null) headingRef.current = h;
      };
      window.addEventListener("deviceorientationabsolute", onOrientation, true);
      window.addEventListener("deviceorientation", onOrientation, true);
      orientationCleanupRef.current = () => {
        window.removeEventListener("deviceorientationabsolute", onOrientation, true);
        window.removeEventListener("deviceorientation", onOrientation, true);
      };

      setPhase("running");
    } catch {
      stop();
      setPhase("error");
      setError("camera_denied");
    }
  }

  const errorMessages: Record<ArError, string> = {
    https_required:
      "Kamera und Kompass benötigen HTTPS (oder localhost). Bitte PickHome über TLS oder lokal testen.",
    camera_denied: "Kamerazugriff wurde verweigert.",
    orientation_denied: "Kompasszugriff wurde verweigert.",
    orientation_unsupported: "Kompass wird in diesem Browser nicht unterstützt.",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-2 p-3 bg-gradient-to-b from-black/70 to-transparent">
        <Link href={backHref} className="text-sm text-white/90 hover:underline shrink-0">
          ← Zurück
        </Link>
        <p className="text-sm truncate opacity-90">{title}</p>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-white/30 shrink-0"
          onClick={() => setShowControls((v) => !v)}
        >
          Zeit
        </button>
      </div>

      {phase === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <p className="text-center text-sm text-white/80 max-w-sm">
            Live-Kamera mit Sonnenmarkierung. Kompass kann ungenau sein — Handy vom Magnetfeld
            weghalten und in Achterform bewegen.
          </p>
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
          <p className="text-center text-sm max-w-sm">{errorMessages[error]}</p>
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

      {showControls && phase === "running" && (
        <div className="absolute bottom-20 left-3 right-3 z-20 rounded-lg bg-black/80 p-3 text-sm space-y-2">
          <input
            type="range"
            min={0}
            max={1440}
            step={15}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-full accent-pn-accent"
          />
          <p className="text-xs opacity-80">{formatSolarTime(selectedDate, timeZone)}</p>
        </div>
      )}
    </div>
  );
}
