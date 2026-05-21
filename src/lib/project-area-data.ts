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

export async function clearProjectAreaDistricts(projectId: string): Promise<void> {
  await prisma.projectAreaDistrict.deleteMany({ where: { projectId } });
}

export async function clearProjectAreaDistrictsForPlzScope(
  projectId: string,
  plzScope: string[]
): Promise<void> {
  const scopedPlz = [...new Set(plzScope.map((plz) => plz.trim()).filter((plz) => /^\d{5}$/.test(plz)))];
  if (scopedPlz.length === 0) return;
  await prisma.projectAreaDistrict.deleteMany({
    where: { projectId, plz: { in: scopedPlz } },
  });
}

export async function replaceProjectAreaDistrictsFromImport(
  projectId: string,
  rows: Array<{ plz: string; districts: string[] }>
): Promise<{ plzCount: number; districtCount: number }> {
  await clearProjectAreaDistricts(projectId);
  if (rows.length === 0) {
    return { plzCount: 0, districtCount: 0 };
  }
  return upsertProjectAreaDistrictsFromImport(projectId, rows);
}

export async function replaceProjectAreaDistrictsForPlzScope(
  projectId: string,
  rows: Array<{ plz: string; districts: string[] }>,
  plzScope: string[]
): Promise<{ plzCount: number; districtCount: number }> {
  const scopedPlz = [...new Set(plzScope.map((plz) => plz.trim()).filter((plz) => /^\d{5}$/.test(plz)))];
  if (scopedPlz.length === 0) {
    return { plzCount: 0, districtCount: 0 };
  }

  const scopeSet = new Set(scopedPlz);
  await prisma.projectAreaDistrict.deleteMany({
    where: { projectId, plz: { in: scopedPlz } },
  });

  const scopedRows = rows.filter((row) => scopeSet.has(row.plz));
  if (scopedRows.length === 0) {
    return { plzCount: 0, districtCount: 0 };
  }
  return upsertProjectAreaDistrictsFromImport(projectId, scopedRows);
}
