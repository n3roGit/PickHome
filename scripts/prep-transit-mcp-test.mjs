import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
await prisma.user.update({
  where: { id: admin.id },
  data: {
    travelMode: "transit",
    transitArrivalHour: 8,
    transitArrivalMinute: 0,
    transitArrivalWeekday: 1,
    transitFallbackMaxKm: 5,
    transitFallbackMode: "bike",
  },
});

let project = await prisma.project.findFirst({ where: { name: "ÖPNV Test" } });
if (!project) {
  project = await prisma.project.create({
    data: {
      name: "ÖPNV Test",
      members: { create: { userId: admin.id, role: "owner" } },
    },
  });
}

let apt = await prisma.apartment.findFirst({
  where: { projectId: project.id, title: "Wohnung Fern" },
});
if (!apt) {
  apt = await prisma.apartment.create({
    data: {
      projectId: project.id,
      title: "Wohnung Fern",
      address: "Marienfelde 1, 12277 Berlin",
      latitude: 52.38,
      longitude: 13.12,
    },
  });
} else {
  await prisma.apartment.update({
    where: { id: apt.id },
    data: {
      address: "Marienfelde 1, 12277 Berlin",
      latitude: 52.38,
      longitude: 13.12,
    },
  });
}

let addr = await prisma.userAddress.findFirst({
  where: { userId: admin.id, label: "Arbeit" },
});
if (!addr) {
  addr = await prisma.userAddress.create({
    data: {
      userId: admin.id,
      label: "Arbeit",
      address: "Alexanderplatz 1, 10178 Berlin",
      latitude: 52.5219,
      longitude: 13.4132,
      isWorkplace: true,
    },
  });
} else {
  await prisma.userAddress.update({
    where: { id: addr.id },
    data: {
      address: "Alexanderplatz 1, 10178 Berlin",
      latitude: 52.5219,
      longitude: 13.4132,
      isWorkplace: true,
    },
  });
}

let aptNear = await prisma.apartment.findFirst({
  where: { projectId: project.id, title: "Wohnung Prenzlauer Berg" },
});
if (!aptNear) {
  aptNear = await prisma.apartment.create({
    data: {
      projectId: project.id,
      title: "Wohnung Prenzlauer Berg",
      address: "Danziger Str. 1, 10405 Berlin",
      latitude: 52.538,
      longitude: 13.42,
    },
  });
} else {
  await prisma.apartment.update({
    where: { id: aptNear.id },
    data: {
      address: "Danziger Str. 1, 10405 Berlin",
      latitude: 52.538,
      longitude: 13.42,
    },
  });
}

await prisma.commuteCache.deleteMany();

const transitLegs = [
  {
    kind: "walk",
    lineName: null,
    fromStop: "Marienfelde, Alt-Marienfelde",
    toStop: "Marienfelde S",
    departureTime: "07:12",
    arrivalTime: "07:18",
    departurePlatform: null,
    arrivalPlatform: null,
    distanceMeters: 420,
  },
  {
    kind: "transit",
    lineName: "S2",
    fromStop: "Marienfelde",
    toStop: "Alexanderplatz",
    departureTime: "07:22",
    arrivalTime: "07:58",
    departurePlatform: "3",
    arrivalPlatform: "2",
    distanceMeters: null,
  },
];

if (addr) {
  await prisma.commuteCache.create({
    data: {
      apartmentId: apt.id,
      userAddressId: addr.id,
      travelMode: "transit",
      distanceMeters: 18500,
      durationSeconds: 2760,
      routeKind: "transit",
      connectionSummary: "S2 (Ankunft Mo 08:00)",
      transitDetailJson: JSON.stringify(transitLegs),
      effectiveMode: null,
    },
  });
}

console.log(`far: http://localhost:3000/project/${project.id}/apartment/${apt.id}`);
console.log(`near: http://localhost:3000/project/${project.id}/apartment/${aptNear.id}`);
await prisma.$disconnect();
