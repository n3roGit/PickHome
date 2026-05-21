/**
 * Apply LLM settings from environment (local dev only).
 *
 * PICKHOME_LLM_BASE_URL  e.g. http://192.168.1.62:7352/v1
 * PICKHOME_LLM_API_KEY   API token
 * PICKHOME_LLM_MODEL     optional, default auto-fastest
 * PICKHOME_LLM_SYSTEM_PROMPT  optional multiline prompt
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = process.env.PICKHOME_LLM_BASE_URL?.trim();
const apiKey = process.env.PICKHOME_LLM_API_KEY?.trim();
const model = process.env.PICKHOME_LLM_MODEL?.trim() || "auto-fastest";
const systemPrompt = process.env.PICKHOME_LLM_SYSTEM_PROMPT?.trim() || null;

async function main() {
  if (!baseUrl || !apiKey) {
    console.error("Set PICKHOME_LLM_BASE_URL and PICKHOME_LLM_API_KEY.");
    process.exit(1);
  }

  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      llmBaseUrl: baseUrl.replace(/\/+$/, ""),
      llmApiKey: apiKey,
      llmModel: model,
      llmSystemPrompt: systemPrompt,
    },
    update: {
      llmBaseUrl: baseUrl.replace(/\/+$/, ""),
      llmApiKey: apiKey,
      llmModel: model,
      llmSystemPrompt: systemPrompt,
    },
  });

  console.log("[pickhome] LLM settings saved.");
  console.log(`  baseUrl: ${baseUrl}`);
  console.log(`  model: ${model}`);
  console.log(`  apiKey: ${apiKey.slice(0, 4)}…`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
