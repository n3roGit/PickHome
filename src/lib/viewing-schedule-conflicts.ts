import { fetchRoute, formatRouteDuration, type RoutePoint } from "@/lib/routing";

export const VIEWING_DURATION_MINUTES = 60;
export const VIEWING_TRAVEL_BUFFER_MINUTES = 10;

export type ViewingScheduleSlot = {
  id: string;
  apartmentId: string;
  apartmentTitle: string;
  scheduledAt: Date;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
};

export type ViewingScheduleWarningKind =
  | "overlap_after"
  | "overlap_before"
  | "tight_after"
  | "tight_before";

export type ViewingScheduleWarning = {
  viewingId: string;
  kind: ViewingScheduleWarningKind;
  otherViewingId: string;
  otherApartmentTitle: string;
  gapMinutes: number;
  travelMinutes: number | null;
  requiredGapMinutes: number;
  message: string;
};

export type GeoPoint = { latitude: number; longitude: number };

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusM = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(a));
}

export function estimateDrivingMinutes(from: GeoPoint, to: GeoPoint): number {
  const meters = haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude);
  const roadKm = (meters / 1000) * 1.25;
  const minutes = (roadKm / 45) * 60;
  return Math.max(5, Math.round(minutes));
}

export function calendarDayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function slotCoords(slot: ViewingScheduleSlot): GeoPoint | null {
  if (slot.latitude == null || slot.longitude == null) return null;
  return { latitude: slot.latitude, longitude: slot.longitude };
}

function requiredGapMinutes(travelMinutes: number | null): number {
  if (travelMinutes != null) return travelMinutes + VIEWING_TRAVEL_BUFFER_MINUTES;
  return 20;
}

function formatGapMinutes(gap: number): string {
  if (gap < 0) return `${Math.abs(gap)} Min. Überlappung`;
  return `${gap} Min.`;
}

function buildPairWarnings(
  earlier: ViewingScheduleSlot,
  later: ViewingScheduleSlot,
  travelMinutes: number | null
): ViewingScheduleWarning[] {
  const earlierEnd = earlier.scheduledAt.getTime() + VIEWING_DURATION_MINUTES * 60_000;
  const gapMinutes = Math.round((later.scheduledAt.getTime() - earlierEnd) / 60_000);
  const required = requiredGapMinutes(travelMinutes);

  if (gapMinutes >= required) return [];

  const travelLabel =
    travelMinutes != null
      ? `ca. ${travelMinutes} Min. Fahrt`
      : "Fahrtzeit unbekannt (Adresse ohne Koordinaten)";

  const warnings: ViewingScheduleWarning[] = [];

  if (gapMinutes < 0) {
    warnings.push({
      viewingId: later.id,
      kind: "overlap_after",
      otherViewingId: earlier.id,
      otherApartmentTitle: earlier.apartmentTitle,
      gapMinutes,
      travelMinutes,
      requiredGapMinutes: required,
      message: `Überlappt mit „${earlier.apartmentTitle}“ (${formatGapMinutes(gapMinutes)}).`,
    });
    warnings.push({
      viewingId: earlier.id,
      kind: "overlap_before",
      otherViewingId: later.id,
      otherApartmentTitle: later.apartmentTitle,
      gapMinutes,
      travelMinutes,
      requiredGapMinutes: required,
      message: `Überlappt mit „${later.apartmentTitle}“ (${formatGapMinutes(gapMinutes)}).`,
    });
    return warnings;
  }

  warnings.push({
    viewingId: later.id,
    kind: "tight_after",
    otherViewingId: earlier.id,
    otherApartmentTitle: earlier.apartmentTitle,
    gapMinutes,
    travelMinutes,
    requiredGapMinutes: required,
    message: `Anschluss zu knapp nach „${earlier.apartmentTitle}“: ${formatGapMinutes(gapMinutes)} bis Start, ${travelLabel} + ${VIEWING_DURATION_MINUTES} Min. Besichtigung davor angenommen (mind. ${required} Min. Puffer).`,
  });
  warnings.push({
    viewingId: earlier.id,
    kind: "tight_before",
    otherViewingId: later.id,
    otherApartmentTitle: later.apartmentTitle,
    gapMinutes,
    travelMinutes,
    requiredGapMinutes: required,
    message: `Anschluss zu knapp vor „${later.apartmentTitle}“: nur ${formatGapMinutes(gapMinutes)} bis der nächste Termin, ${travelLabel} nötig.`,
  });
  return warnings;
}

export function buildViewingScheduleWarnings(
  slots: ViewingScheduleSlot[],
  timeZone: string,
  resolveTravelMinutes: (from: GeoPoint, to: GeoPoint) => number | null,
  options?: { now?: Date; onlyUpcoming?: boolean }
): Map<string, ViewingScheduleWarning[]> {
  const now = options?.now ?? new Date();
  const onlyUpcoming = options?.onlyUpcoming !== false;
  const relevant = onlyUpcoming
    ? slots.filter((s) => s.scheduledAt.getTime() + VIEWING_DURATION_MINUTES * 60_000 > now.getTime())
    : slots;

  const byDay = new Map<string, ViewingScheduleSlot[]>();
  for (const slot of relevant) {
    const key = calendarDayKey(slot.scheduledAt, timeZone);
    const list = byDay.get(key) ?? [];
    list.push(slot);
    byDay.set(key, list);
  }

  const result = new Map<string, ViewingScheduleWarning[]>();

  for (const daySlots of byDay.values()) {
    if (daySlots.length < 2) continue;
    const sorted = [...daySlots].sort(
      (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const earlier = sorted[i];
      const later = sorted[i + 1];
      const from = slotCoords(earlier);
      const to = slotCoords(later);
      const travel =
        from && to ? resolveTravelMinutes(from, to) : null;
      for (const warning of buildPairWarnings(earlier, later, travel)) {
        const existing = result.get(warning.viewingId) ?? [];
        existing.push(warning);
        result.set(warning.viewingId, existing);
      }
    }
  }

  return result;
}

export function warningsForViewing(
  map: Map<string, ViewingScheduleWarning[]>,
  viewingId: string
): ViewingScheduleWarning[] {
  return map.get(viewingId) ?? [];
}

export function viewingWarningsToRecord(
  map: Map<string, ViewingScheduleWarning[]>
): Record<string, ViewingScheduleWarning[]> {
  return Object.fromEntries(map);
}

export async function fetchDrivingMinutesBetween(
  from: GeoPoint,
  to: GeoPoint
): Promise<number | null> {
  const route = await fetchRoute(from as RoutePoint, to as RoutePoint, "driving", {
    timeoutMs: 8_000,
  });
  if (!route) return estimateDrivingMinutes(from, to);
  return Math.max(1, Math.round(route.durationSeconds / 60));
}

export async function buildViewingScheduleWarningsAsync(
  slots: ViewingScheduleSlot[],
  timeZone: string,
  options?: { now?: Date; onlyUpcoming?: boolean }
): Promise<Map<string, ViewingScheduleWarning[]>> {
  const travelCache = new Map<string, number | null>();

  const byDay = new Map<string, ViewingScheduleSlot[]>();
  const now = options?.now ?? new Date();
  const onlyUpcoming = options?.onlyUpcoming !== false;
  const relevant = onlyUpcoming
    ? slots.filter((s) => s.scheduledAt.getTime() + VIEWING_DURATION_MINUTES * 60_000 > now.getTime())
    : slots;

  for (const slot of relevant) {
    const key = calendarDayKey(slot.scheduledAt, timeZone);
    const list = byDay.get(key) ?? [];
    list.push(slot);
    byDay.set(key, list);
  }

  const pairs: { from: GeoPoint; to: GeoPoint; key: string }[] = [];
  for (const daySlots of byDay.values()) {
    if (daySlots.length < 2) continue;
    const sorted = [...daySlots].sort(
      (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = slotCoords(sorted[i]);
      const to = slotCoords(sorted[i + 1]);
      if (!from || !to) continue;
      const key = `${from.latitude},${from.longitude}->${to.latitude},${to.longitude}`;
      if (!travelCache.has(key)) pairs.push({ from, to, key });
    }
  }

  await Promise.all(
    pairs.map(async ({ from, to, key }) => {
      const minutes = await fetchDrivingMinutesBetween(from, to);
      travelCache.set(key, minutes);
    })
  );

  return buildViewingScheduleWarnings(slots, timeZone, (from, to) => {
    const key = `${from.latitude},${from.longitude}->${to.latitude},${to.longitude}`;
    if (travelCache.has(key)) return travelCache.get(key) ?? null;
    return estimateDrivingMinutes(from, to);
  }, options);
}

export function formatTravelMinutesForDisplay(minutes: number | null): string {
  if (minutes == null) return "unbekannt";
  return formatRouteDuration(minutes * 60);
}
