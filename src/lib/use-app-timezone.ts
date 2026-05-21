"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_APP_TIME_ZONE } from "@/lib/timezone";

let cachedTimeZone: string | null = null;

export function invalidateAppTimeZoneCache() {
  cachedTimeZone = null;
}

export function useAppTimeZone(): string {
  const [timeZone, setTimeZone] = useState(cachedTimeZone ?? DEFAULT_APP_TIME_ZONE);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/app/timezone");
      if (!res.ok) return;
      const data = (await res.json()) as { timeZone?: string };
      if (data.timeZone) {
        cachedTimeZone = data.timeZone;
        setTimeZone(data.timeZone);
      }
    } catch {
      // keep default
    }
  }, []);

  useEffect(() => {
    if (cachedTimeZone) {
      setTimeZone(cachedTimeZone);
      return;
    }
    void load();
  }, [load]);

  return timeZone;
}
