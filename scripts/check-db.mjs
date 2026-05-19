import { PrismaClient } from "@prisma/client";
import { existsSync } from "fs";
import { join } from "path";

const paths = [
  { label: "env ../data/pickhome.db", url: "file:../data/pickhome.db" },
  { label: "env ./data/pickhome.db", url: "file:./data/pickhome.db" },
  { label: "absolute data/pickhome.db", url: `file:${join(process.cwd(), "data", "pickhome.db").replace(/\\/g, "/")}` },
];

for (const { label, url } of paths) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const apts = await p.apartment.count();
    const projects = await p.project.count();
    console.log(`${label}: projects=${projects} apartments=${apts}`);
  } catch (e) {
    console.log(`${label}: ERROR`, e.message?.split("\n")[0]);
  } finally {
    await p.$disconnect();
  }
}

console.log("\nFiles:");
for (const f of ["data/pickhome.db", "prisma/data/pickhome.db", "prisma/prisma/dev.db"]) {
  console.log(`  ${f}: ${existsSync(f) ? "exists" : "missing"}`);
}

const stray = [
  ["prisma/data/pickhome.db", `file:${join(process.cwd(), "prisma/data/pickhome.db").replace(/\\/g, "/")}`],
  ["prisma/prisma/dev.db", `file:${join(process.cwd(), "prisma/prisma/dev.db").replace(/\\/g, "/")}`],
];

async function dumpUsers(url, label) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const users = await p.user.findMany({ select: { username: true } });
    console.log(`  ${label} users:`, users.map((u) => u.username).join(", ") || "(none)");
  } catch {
    console.log(`  ${label} users: (unreadable)`);
  } finally {
    await p.$disconnect();
  }
}

console.log("\nUsers per DB:");
await dumpUsers(`file:${join(process.cwd(), "data/pickhome.db").replace(/\\/g, "/")}`, "data/pickhome.db");
await dumpUsers(`file:${join(process.cwd(), "prisma/prisma/dev.db").replace(/\\/g, "/")}`, "prisma/prisma/dev.db");

console.log("\nStray DB contents:");
for (const [label, url] of stray) {
  if (!existsSync(label)) continue;
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const apts = await p.apartment.count();
    const projects = await p.project.count();
    console.log(`  ${label}: projects=${projects} apartments=${apts}`);
  } catch (e) {
    console.log(`  ${label}: ${e.message?.split("\n")[0]}`);
  } finally {
    await p.$disconnect();
  }
}
