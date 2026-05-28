"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ApartmentSunMap } from "@/components/ApartmentSunMap";
import { SolarSeasonDateControls } from "@/components/SolarSeasonDateControls";
import {
  compassFromAzimuth,
  dateAtMinutesOnDay,
  formatSolarTime,
  getSolarDayTimes,
  getSolarSample,
  minutesFromDate,
} from "@/lib/solar-position";
import { buildSolarArHref } from "@/lib/solar-seasons";

type Props = {
  projectId: string;
  apartmentId: string;
  latitude: number;
  longitude: number;
  timeZone: string;
  nextViewingIso: string | null;
};

export function ApartmentSolarPanel({
  projectId,
  apartmentId,
  latitude,
  longitude,
  timeZone,
  nextViewingIso,
}: Props) {
  const [dayDate, setDayDate] = useState(() => new Date());
  const [minutes, setMinutes] = useState(() => minutesFromDate(new Date()));
  const [hasOrientationApi, setHasOrientationApi] = useState(false);

  const syncTimeToNow = useCallback(() => {
    setMinutes(minutesFromDate(new Date()));
  }, []);

  const handleDayDateChange = useCallback((date: Date) => {
    setDayDate(date);
    setMinutes(minutesFromDate(new Date()));
  }, []);

  useEffect(() => {
    setHasOrientationApi(typeof window !== "undefined" && "DeviceOrientationEvent" in window);
  }, []);

  const selectedDate = useMemo(
    () => dateAtMinutesOnDay(dayDate, minutes),
    [dayDate, minutes]
  );

  const sample = useMemo(
    () => getSolarSample(selectedDate, latitude, longitude),
    [selectedDate, latitude, longitude]
  );

  const dayTimes = useMemo(
    () => getSolarDayTimes(dayDate, latitude, longitude),
    [dayDate, latitude, longitude]
  );

  const viewingSample = useMemo(() => {
    if (!nextViewingIso) return null;
    const at = new Date(nextViewingIso);
    if (Number.isNaN(at.getTime())) return null;
    return getSolarSample(at, latitude, longitude);
  }, [nextViewingIso, latitude, longitude]);

  const direction = compassFromAzimuth(sample.azimuthDeg);
  const arHref = buildSolarArHref(
    `/project/${projectId}/apartment/${apartmentId}/sonne-ar`,
    dayDate
  );

  return (
    <CollapsibleSection
      title="Sonnenstand"
      subtitle="Sonnenverlauf und Licht zur gewählten Uhrzeit — Orientierung für Besichtigung und Sonneneinstrahlung."
      defaultOpen={false}
      onOpenChange={(open) => {
        if (open) {
          syncTimeToNow();
        }
      }}
    >
      <div data-testid="solar-panel" className="space-y-4 text-sm">
        <div className="rounded-lg bg-pn-bg-subtle border border-pn-border px-4 py-3">
          <p className="font-medium text-pn-text-primary">
            {sample.isUp ? "Sonne steht am Himmel" : "Sonne ist untergegangen"}
          </p>
          <p className="mt-1 text-pn-text-secondary tabular-nums">
            Höhe {sample.altitudeDeg.toFixed(1)}° · Richtung {direction} ({sample.azimuthDeg.toFixed(0)}°)
          </p>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-pn-text-secondary">
          <div>
            <dt className="text-xs text-pn-text-tertiary">Sonnenaufgang</dt>
            <dd className="tabular-nums">{formatSolarTime(dayTimes.sunrise, timeZone)}</dd>
          </div>
          <div>
            <dt className="text-xs text-pn-text-tertiary">Sonnenuntergang</dt>
            <dd className="tabular-nums">{formatSolarTime(dayTimes.sunset, timeZone)}</dd>
          </div>
          <div>
            <dt className="text-xs text-pn-text-tertiary">Solarmittag</dt>
            <dd className="tabular-nums">{formatSolarTime(dayTimes.solarNoon, timeZone)}</dd>
          </div>
          <div>
            <dt className="text-xs text-pn-text-tertiary">Goldene Stunde (morgens)</dt>
            <dd className="tabular-nums">
              {formatSolarTime(dayTimes.goldenHourMorningEnd, timeZone)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-pn-text-tertiary">Goldene Stunde (abends)</dt>
            <dd className="tabular-nums">
              {formatSolarTime(dayTimes.goldenHourEveningStart, timeZone)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="min-w-0 sm:max-w-xs">
            <SolarSeasonDateControls dayDate={dayDate} onDayDateChange={handleDayDateChange} />
          </div>
          <label className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="text-xs text-pn-text-tertiary">
              Uhrzeit ({formatSolarTime(selectedDate, timeZone)})
            </span>
            <input
              type="range"
              min={0}
              max={1440}
              step={15}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              data-testid="solar-time-slider"
              className="w-full accent-pn-accent"
            />
          </label>
        </div>

        {viewingSample && nextViewingIso && (
          <p className="text-pn-text-secondary">
            Beim nächsten Besichtigungstermin am{" "}
            <time dateTime={nextViewingIso}>
              {new Date(nextViewingIso).toLocaleString("de-DE", {
                timeZone,
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>{" "}
            steht die Sonne im{" "}
            <strong>{compassFromAzimuth(viewingSample.azimuthDeg)}</strong> (
            {viewingSample.azimuthDeg.toFixed(0)}°, {viewingSample.altitudeDeg.toFixed(0)}° Höhe
            {viewingSample.isUp ? "" : ", unter Horizont"}).
          </p>
        )}

        {hasOrientationApi && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={arHref}
              data-testid="solar-open-ar"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-pn-accent text-white hover:opacity-90"
            >
              AR vor Ort öffnen
            </Link>
          </div>
        )}

        <ApartmentSunMap
          latitude={latitude}
          longitude={longitude}
          selectedDate={selectedDate}
        />
      </div>
    </CollapsibleSection>
  );
}
