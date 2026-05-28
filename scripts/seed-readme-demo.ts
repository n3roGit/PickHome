/**
 * Demo data for README screenshots and local previews.
 * Addresses: public OSM places from tests/helpers/synthetic-addresses.ts only.
 * Never copy from production backups, local data/, or house-hunt notes.
 *
 * Usage: npx tsx scripts/seed-readme-demo.ts
 * Login: demo / demo  (partner / partner)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_USER } from "../src/lib/auth";
import { seedProjectCriteria } from "../src/lib/project-data";
import {
  TEST_ADDRESS_BERLIN_ENRICHED,
  TEST_ADDRESS_BERLIN_POSTCODE,
  TEST_ADDRESS_BERLIN_DISTRICT,
  TEST_ADDRESS_BREMEN_LAT,
  TEST_ADDRESS_BREMEN_LON,
  TEST_ADDRESS_BREMEN_RAW,
  TEST_ADDRESS_HAMBURG_ENRICHED,
  TEST_ADDRESS_MUNICH_ENRICHED,
} from "../tests/helpers/synthetic-addresses";

const prisma = new PrismaClient();

const DEMO_USER_ID = "readme-demo-user";
const PARTNER_USER_ID = "readme-demo-partner";
const PROJECT_ID = "readme-demo-project";

const APT_ACTIVE_HIGH = "readme-demo-apt-high";
const APT_ACTIVE_MID = "readme-demo-apt-mid";
const APT_ACTIVE_LOW = "readme-demo-apt-low";
const APT_ARCHIVED = "readme-demo-apt-archived";

const FAKE_LISTING = "https://example.com/listing/demo";

/** Approximate coords for public demo addresses (OSM/Nominatim). */
const COORDS = {
  berlin: { lat: 52.516895, lon: 13.388856 },
  hamburg: { lat: 53.5434, lon: 9.9953 },
  munich: { lat: 48.137154, lon: 11.576124 },
  bremen: { lat: TEST_ADDRESS_BREMEN_LAT, lon: TEST_ADDRESS_BREMEN_LON },
} as const;

async function upsertDemoUser(
  id: string,
  username: string,
  name: string
) {
  const passwordHash = await bcrypt.hash(username, 10);
  return prisma.user.upsert({
    where: { id },
    update: { username, name, passwordHash, role: ROLE_USER, totpSecret: null, totpEnabledAt: null },
    create: { id, username, name, passwordHash, role: ROLE_USER },
  });
}

async function clearReadmeDemo() {
  await prisma.project.deleteMany({ where: { id: PROJECT_ID } });
  await prisma.user.deleteMany({
    where: { id: { in: [DEMO_USER_ID, PARTNER_USER_ID] } },
  });
}

async function main() {
  await clearReadmeDemo();

  const demo = await upsertDemoUser(DEMO_USER_ID, "demo", "Alex Demo");
  const partner = await upsertDemoUser(PARTNER_USER_ID, "partner", "Sam Demo");

  const areaFilterConfig = {
    ortKeys: ["Berlin|Berlin"],
    selectedPlz: [TEST_ADDRESS_BERLIN_POSTCODE],
    selectedDistricts: [TEST_ADDRESS_BERLIN_DISTRICT],
  };

  const project = await prisma.project.create({
    data: {
      id: PROJECT_ID,
      name: "Demo-Suchprojekt",
      budget: 350_000,
      federalStateCode: "BE",
      brokerBuyerRate: 3.57,
      equityAmount: 80_000,
      loanTermYears: 25,
      interestRate: 0.038,
      dealbreakerThreshold: 3,
      netHouseholdIncome: 5_200,
      monthlyFixedCosts: 650,
      areaFilterOrtKey: "Berlin|Berlin",
      areaFilterConfig: JSON.stringify(areaFilterConfig),
      members: {
        create: [
          { userId: demo.id, role: "owner" },
          { userId: partner.id, role: "partner" },
        ],
      },
      areaDistricts: {
        create: [
          { plz: TEST_ADDRESS_BERLIN_POSTCODE, name: TEST_ADDRESS_BERLIN_DISTRICT },
        ],
      },
    },
  });

  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      llmBaseUrl: "https://example.com/v1",
      llmApiKey: "readme-demo-only",
      llmModel: "demo",
      llmSystemPrompt: "Demo assistant for README screenshots only.",
    },
    update: {
      llmBaseUrl: "https://example.com/v1",
      llmApiKey: "readme-demo-only",
      llmModel: "demo",
      llmSystemPrompt: "Demo assistant for README screenshots only.",
    },
  });

  await seedProjectCriteria(project.id);

  const criteria = await prisma.criterion.findMany({
    where: { group: { projectId: project.id } },
    select: { id: true, name: true },
  });
  const byName = new Map(criteria.map((c) => [c.name, c.id]));

  const apartments = [
    {
      id: APT_ACTIVE_HIGH,
      title: "Beispielwohnung — Berlin Mitte",
      address: TEST_ADDRESS_BERLIN_ENRICHED,
      price: 285_000,
      sizeSqm: 78,
      plotSizeSqm: null as number | null,
      floor: 2,
      yearBuilt: 1998,
      energyClass: "C",
      ...COORDS.berlin,
      brokerInvolved: true,
      hoaFeeMonthly: 220,
      heatingCostMonthly: 95,
    },
    {
      id: APT_ACTIVE_MID,
      title: "Demo-Haus — Hamburg HafenCity",
      address: TEST_ADDRESS_HAMBURG_ENRICHED,
      price: 320_000,
      sizeSqm: 112,
      plotSizeSqm: 420,
      floor: null as number | null,
      yearBuilt: 1975,
      energyClass: "D",
      ...COORDS.hamburg,
      brokerInvolved: false,
      hoaFeeMonthly: null as number | null,
      heatingCostMonthly: 140,
    },
    {
      id: APT_ACTIVE_LOW,
      title: "Test-ETW — München Zentrum",
      address: TEST_ADDRESS_MUNICH_ENRICHED,
      price: 410_000,
      sizeSqm: 65,
      plotSizeSqm: null as number | null,
      floor: 4,
      yearBuilt: 2012,
      energyClass: "B",
      ...COORDS.munich,
      brokerInvolved: true,
      hoaFeeMonthly: 310,
      heatingCostMonthly: 70,
    },
    {
      id: APT_ARCHIVED,
      title: "Archiv: zu teuer — Bremen",
      address: TEST_ADDRESS_BREMEN_RAW,
      price: 520_000,
      sizeSqm: 95,
      plotSizeSqm: null as number | null,
      floor: 1,
      yearBuilt: 2005,
      energyClass: "B",
      ...COORDS.bremen,
      brokerInvolved: true,
      hoaFeeMonthly: 280,
      heatingCostMonthly: 110,
      archived: true,
    },
  ] as const;

  for (const apt of apartments) {
    const { lat, lon, ...rest } = apt;
    await prisma.apartment.create({
      data: {
        projectId: project.id,
        title: rest.title,
        address: rest.address,
        latitude: lat,
        longitude: lon,
        price: rest.price,
        sizeSqm: rest.sizeSqm,
        plotSizeSqm: rest.plotSizeSqm,
        floor: rest.floor,
        yearBuilt: rest.yearBuilt,
        energyClass: rest.energyClass,
        brokerInvolved: rest.brokerInvolved,
        hoaFeeMonthly: rest.hoaFeeMonthly,
        heatingCostMonthly: rest.heatingCostMonthly,
        id: rest.id,
        listingUrl: `${FAKE_LISTING}/${rest.id}`,
        description:
          "Demo-Beschreibung für Screenshots — kein echtes Exposé, keine Produktionsdaten.",
        notes: "Besichtigung: Demo-Notiz vom 15.03.",
        archivedAt: "archived" in rest && rest.archived ? new Date("2026-04-01") : undefined,
        archiveReason: "archived" in rest && rest.archived ? "price" : undefined,
        archiveNote: "archived" in rest && rest.archived ? "über Budget" : undefined,
      },
    });
  }

  const scorePairs: { aptId: string; userId: string; scores: Record<string, number> }[] = [
    {
      aptId: APT_ACTIVE_HIGH,
      userId: demo.id,
      scores: {
        Kaufpreis: 8,
        Wohnfläche: 7,
        Zustand: 7,
        Stadtteil: 8,
        Arbeitsweg: 7,
        Wohngefühl: 9,
        Fluglärm: 8,
      },
    },
    {
      aptId: APT_ACTIVE_HIGH,
      userId: partner.id,
      scores: {
        Kaufpreis: 7,
        Wohnfläche: 8,
        Zustand: 6,
        Stadtteil: 7,
        Arbeitsweg: 6,
        Wohngefühl: 8,
        Fluglärm: 7,
      },
    },
    {
      aptId: APT_ACTIVE_MID,
      userId: demo.id,
      scores: { Kaufpreis: 6, Wohnfläche: 9, Zustand: 5, Stadtteil: 6, Wohngefühl: 7 },
    },
    {
      aptId: APT_ACTIVE_MID,
      userId: partner.id,
      scores: { Kaufpreis: 5, Wohnfläche: 8, Zustand: 6, Stadtteil: 7, Wohngefühl: 6 },
    },
    {
      aptId: APT_ACTIVE_LOW,
      userId: demo.id,
      scores: { Kaufpreis: 3, Wohnfläche: 5, Zustand: 8, Stadtteil: 4, Fluglärm: 2 },
    },
    {
      aptId: APT_ACTIVE_LOW,
      userId: partner.id,
      scores: { Kaufpreis: 4, Wohnfläche: 6, Zustand: 7, Stadtteil: 5, Fluglärm: 3 },
    },
  ];

  for (const { aptId, userId, scores } of scorePairs) {
    for (const [name, score] of Object.entries(scores)) {
      const criterionId = byName.get(name);
      if (!criterionId) continue;
      await prisma.rating.create({
        data: { apartmentId: aptId, criterionId, userId, score },
      });
    }
  }

  const checklistItems = await prisma.checklistItem.findMany({
    where: { projectId: project.id },
    take: 6,
    orderBy: { sortOrder: "asc" },
  });
  for (const [i, item] of checklistItems.entries()) {
    await prisma.checklistEntry.create({
      data: {
        apartmentId: APT_ACTIVE_HIGH,
        itemId: item.id,
        status: i % 3 === 0 ? "ok" : i % 3 === 1 ? "not_ok" : "unset",
        note: i === 0 ? "Demo-Hinweis Checkliste" : null,
      },
    });
  }

  const now = new Date();
  const viewingSlots = [
    { aptId: APT_ACTIVE_HIGH, days: 7, hour: 10 },
    { aptId: APT_ACTIVE_MID, days: 7, hour: 14 },
    { aptId: APT_ACTIVE_LOW, days: 14, hour: 11 },
    { aptId: APT_ACTIVE_HIGH, days: -10, hour: 15 },
  ];
  for (const slot of viewingSlots) {
    const scheduledAt = new Date(now);
    scheduledAt.setDate(scheduledAt.getDate() + slot.days);
    scheduledAt.setHours(slot.hour, 0, 0, 0);
    await prisma.viewingAppointment.create({
      data: {
        apartmentId: slot.aptId,
        scheduledAt,
        note: slot.days < 0 ? "Vergangene Demo-Besichtigung" : "Geplante Demo-Besichtigung",
      },
    });
  }

  await prisma.apartmentPriceHistory.createMany({
    data: [
      {
        apartmentId: APT_ACTIVE_HIGH,
        price: 295_000,
        recordedAt: new Date("2026-03-01"),
        source: "listing_import",
      },
      {
        apartmentId: APT_ACTIVE_HIGH,
        price: 285_000,
        recordedAt: new Date("2026-04-15"),
        source: "manual",
      },
    ],
  });

  // Optional commute anchor for demo users (public address, Berlin).
  for (const userId of [demo.id, partner.id]) {
    await prisma.userAddress.create({
      data: {
        userId,
        label: "Zuhause (Demo)",
        address: TEST_ADDRESS_BERLIN_ENRICHED,
        latitude: COORDS.berlin.lat,
        longitude: COORDS.berlin.lon,
        sortOrder: 0,
      },
    });
  }

  try {
    const { refreshBorisForApartment } = await import("../src/lib/boris-cache");
    await refreshBorisForApartment(prisma, APT_ACTIVE_MID);
    console.log("[pickhome] BORIS cache warmed for demo house (Hamburg).");
  } catch {
    console.warn("[pickhome] BORIS prefetch skipped (offline?) — expand Finanzen before screenshot.");
  }

  console.log("[pickhome] README demo data ready.");
  console.log("  Addresses: public OSM demo places (synthetic-addresses.ts)");
  console.log("  Login: demo / demo");
  console.log(`  Project: /project/${PROJECT_ID}`);
  console.log(`  Top apartment: /project/${PROJECT_ID}/apartment/${APT_ACTIVE_HIGH}`);
  console.log(`  Checklist fill: /project/${PROJECT_ID}/apartment/${APT_ACTIVE_HIGH}/checklist`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
