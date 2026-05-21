import {
  apartmentLlmHasSourceText,
  buildApartmentLlmContext,
  type ApartmentLlmContextInput,
} from "@/lib/apartment-llm-context";
import { callLlmChat, type LlmChatMessage } from "@/lib/llm-client";
import { resolveLlmSystemPrompt } from "@/lib/llm-settings";

const APARTMENT_CHAT_TASK = `Im aktuellen Gespräch beantwortest du Fragen ausschließlich zur unten angegebenen Immobilie.`;

export async function answerApartmentLlmQuestion(input: {
  apartment: ApartmentLlmContextInput;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<{ ok: true; answer: string } | { ok: false; error: string }> {
  if (!apartmentLlmHasSourceText(input.apartment)) {
    return { ok: false, error: "no_source_text" };
  }

  const context = buildApartmentLlmContext(input.apartment);
  const basePrompt = await resolveLlmSystemPrompt();
  const chatMessages: LlmChatMessage[] = [
    {
      role: "system",
      content: `${basePrompt}\n\n${APARTMENT_CHAT_TASK}\n\n--- Immobilie ---\n${context}`,
    },
    ...input.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const result = await callLlmChat(chatMessages, { maxTokens: 1500, temperature: 0.3 });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, answer: result.content };
}
