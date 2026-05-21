import { NextResponse } from "next/server";
import { testLlmConnection, testLlmConnectionWithConfig } from "@/lib/llm-client";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { parseLlmApiKeyInput, parseLlmBaseUrlInput } from "@/lib/llm-settings";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: { baseUrl?: string; apiKey?: string } = {};
  try {
    body = (await req.json()) as { baseUrl?: string; apiKey?: string };
  } catch {
    body = {};
  }

  const baseUrlRaw = String(body.baseUrl ?? "").trim();
  const apiKeyRaw = String(body.apiKey ?? "").trim();

  if (baseUrlRaw && apiKeyRaw) {
    try {
      const baseUrl = parseLlmBaseUrlInput(baseUrlRaw);
      const apiKey = parseLlmApiKeyInput(apiKeyRaw);
      if (!baseUrl || !apiKey) {
        return NextResponse.json(
          { ok: false, error: "not_configured" },
          { status: 400 }
        );
      }
      const result = await testLlmConnectionWithConfig({ baseUrl, apiKey });
      if (result.ok) {
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json(result, { status: 400 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "invalid_config";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  }

  const result = await testLlmConnection();
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(result, { status: 400 });
}
