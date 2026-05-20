import {
  areaFilterOrtKeys,
  parseAreaFilterConfig,
  serializeAreaFilterConfig,
} from "@/lib/area-filter";
import { prisma } from "@/lib/prisma";

/** Copy legacy areaFilterOrtKey into areaFilterConfig.ortKeys when missing. */
export async function backfillAreaFilterOrtKeys(): Promise<number> {
  const projects = await prisma.project.findMany({
    where: {
      areaFilterOrtKey: { not: null },
      areaFilterConfig: { not: null },
    },
    select: { id: true, areaFilterOrtKey: true, areaFilterConfig: true },
  });

  let updated = 0;
  for (const project of projects) {
    const config = parseAreaFilterConfig(project.areaFilterConfig);
    const legacyKey = project.areaFilterOrtKey?.trim();
    if (!config || !legacyKey || areaFilterOrtKeys(null, config).length > 0) continue;

    await prisma.project.update({
      where: { id: project.id },
      data: {
        areaFilterConfig: serializeAreaFilterConfig({
          ...config,
          ortKeys: [legacyKey],
        }),
      },
    });
    updated++;
  }
  return updated;
}
