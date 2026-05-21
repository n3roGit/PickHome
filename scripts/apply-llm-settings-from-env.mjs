/**
 * One-off / dev helper: copies PICKHOME_LLM_* from .env.local into AppSettings.
 * No secrets in this file — set values only in gitignored .env.local.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(name) {
  const path = join(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const baseUrl = process.env.PICKHOME_LLM_BASE_URL?.trim().replace(/\/+$/, "");
const apiKey = process.env.PICKHOME_LLM_API_KEY?.trim();
const model = process.env.PICKHOME_LLM_MODEL?.trim().replace(/^modelrelay\//i, "") || null;

if (!baseUrl || !apiKey) {
  console.error(
    "[pickhome] Set PICKHOME_LLM_BASE_URL and PICKHOME_LLM_API_KEY in .env.local (gitignored)."
  );
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", llmBaseUrl: baseUrl, llmApiKey: apiKey, llmModel: model },
    update: { llmBaseUrl: baseUrl, llmApiKey: apiKey, llmModel: model },
  });
  console.log("[pickhome] LLM settings applied to local database.");
  if (model) {
    console.log(`[pickhome] Model: ${model}`);
  }
} finally {
  await prisma.$disconnect();
}
