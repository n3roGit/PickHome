import { NextResponse } from "next/server";
import { getApartmentLlmBundle } from "@/lib/apartment-llm-data";
import { normalizeApartmentChatMessages } from "@/lib/apartment-llm-chat-request";
import { answerApartmentLlmQuestion } from "@/lib/llm-apartment-chat";
import { getSessionUser } from "@/lib/auth";
import { isLlmConfigured } from "@/lib/llm-client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ apartmentId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { apartmentId } = await params;
  const bundle = await getApartmentLlmBundle(apartmentId, user);
  if (!bundle) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await isLlmConfigured())) {
    return NextResponse.json({ error: "llm_not_configured" }, { status: 503 });
  }

  let body: {
    message?: string;
    history?: { role: string; content: string }[];
    messages?: { role: string; content: string }[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const messages = normalizeApartmentChatMessages(body);
  if (!messages) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }

  const result = await answerApartmentLlmQuestion({
    apartment: bundle.apartment,
    messages,
  });

  if (!result.ok) {
    const status =
      result.error === "no_source_text" ? 422 : result.error === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    answer: result.answer,
    webSearchEnabled: result.webSearchEnabled,
    webSearchUsed: result.webSearchUsed,
  });
}
