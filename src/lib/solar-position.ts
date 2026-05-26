import SunCalc from "suncalc";

export type SolarSample = {
  date: Date;
  azimuthDeg: number;
  altitudeDeg: number;
  isUp: boolean;
};

export type SolarDayTimes = {
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date | null;
  goldenHourMorningEnd: Date | null;
  goldenHourEveningStart: Date | null;
};

export type CompassDirection = "N" | "NO" | "O" | "SO" | "S" | "SW" | "W" | "NW";

const RAD_TO_DEG = 180 / Math.PI;

/** Azimuth from north, clockwise (0 = N, 90 = E, 180 = S). */
export function azimuthFromNorthRad(azimuthRad: number): number {
  const deg = (azimuthRad * RAD_TO_DEG + 180) % 360;
  return deg < 0 ? deg + 360 : deg;
}

export function altitudeFromRad(altitudeRad: number): number {
  return altitudeRad * RAD_TO_DEG;
}

function toSample(date: Date, lat: number, lng: number): SolarSample {
  const pos = SunCalc.getPosition(date, lat, lng);
  const altitudeDeg = altitudeFromRad(pos.altitude);
  return {
    date,
    azimuthDeg: azimuthFromNorthRad(pos.azimuth),
    altitudeDeg,
    isUp: altitudeDeg > 0,
  };
}

export function getSolarSample(date: Date, lat: number, lng: number): SolarSample {
  return toSample(date, lat, lng);
}

export function getSolarDayTimes(date: Date, lat: number, lng: number): SolarDayTimes {
  const times = SunCalc.getTimes(date, lat, lng);
  return {
    sunrise: times.sunrise ?? null,
    sunset: times.sunset ?? null,
    solarNoon: times.solarNoon ?? null,
    goldenHourMorningEnd: times.goldenHourEnd ?? null,
    goldenHourEveningStart: times.goldenHour ?? null,
  };
}

export function getSolarArc(
  date: Date,
  lat: number,
  lng: number,
  stepMinutes = 30
): SolarSample[] {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const samples: SolarSample[] = [];
  const stepMs = stepMinutes * 60 * 1000;
  for (let ms = 0; ms < 24 * 60 * 60 * 1000; ms += stepMs) {
    const at = new Date(dayStart.getTime() + ms);
    samples.push(toSample(at, lat, lng));
  }
  return samples;
}

export function compassFromAzimuth(azimuthDeg: number): CompassDirection {
  const normalized = ((azimuthDeg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  const labels: CompassDirection[] = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
  return labels[index] ?? "N";
}

/** Destination point from lat/lng, bearing from north (deg), distance (m). */
export function destinationPoint(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceM: number
): { lat: number; lng: number } {
  const R = 6_371_000;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const d = distanceM / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}

export function formatSolarTime(date: Date | null, timeZone: string): string {
  if (!date || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("de-DE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dateAtMinutesOnDay(baseDate: Date, minutesFromMidnight: number): Date {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutesFromMidnight);
  return d;
}

export function minutesFromDate(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}
