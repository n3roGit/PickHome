import { prisma } from "@/lib/prisma";

export function parseDistrictNamesInput(raw: string): string[] {
  const parts = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)].sort((a, b) => a.localeCompare(b, "de"));
}

export async function fetchProjectAreaDistricts(
  projectId: string
): Promise<Record<string, string[]>> {
  const rows = await prisma.projectAreaDistrict.findMany({
    where: { projectId },
    orderBy: [{ plz: "asc" }, { name: "asc" }],
  });

  const byPlz: Record<string, string[]> = {};
  for (const row of rows) {
    if (!byPlz[row.plz]) byPlz[row.plz] = [];
    byPlz[row.plz].push(row.name);
  }
  return byPlz;
}

export async function upsertProjectAreaDistrictsFromImport(
  projectId: string,
  rows: Array<{ plz: string; districts: string[] }>
): Promise<{ plzCount: number; districtCount: number }> {
  let districtCount = 0;
  for (const row of rows) {
    for (const name of row.districts) {
      await prisma.projectAreaDistrict.upsert({
        where: { projectId_plz_name: { projectId, plz: row.plz, name } },
        create: { projectId, plz: row.plz, name },
        update: {},
      });
      districtCount += 1;
    }
  }
  return { plzCount: rows.length, districtCount };
}

export async function deleteProjectAreaDistrict(
  projectId: string,
  plz: string,
  name: string
): Promise<void> {
  await prisma.projectAreaDistrict.deleteMany({
    where: { projectId, plz, name },
  });
}
