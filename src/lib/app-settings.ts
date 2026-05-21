import { DEFAULT_APP_TIME_ZONE, isValidTimeZone } from "@/lib/timezone";
import { prisma } from "@/lib/prisma";

export const APP_SETTINGS_ID = "default";

export async function getOrCreateAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    create: { id: APP_SETTINGS_ID },
    update: {},
  });
}

export async function getAppTimeZone(): Promise<string> {
  const settings = await getOrCreateAppSettings();
  return settings.timeZone;
}

export async function updateAppTimeZone(timeZone: string): Promise<string> {
  const trimmed = timeZone.trim();
  if (!isValidTimeZone(trimmed)) {
    throw new Error("invalid_timezone");
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    create: { id: APP_SETTINGS_ID, timeZone: trimmed },
    update: { timeZone: trimmed },
  });

  return settings.timeZone;
}

export function resolveAppTimeZone(timeZone: string | null | undefined): string {
  if (timeZone && isValidTimeZone(timeZone)) return timeZone;
  return DEFAULT_APP_TIME_ZONE;
}
