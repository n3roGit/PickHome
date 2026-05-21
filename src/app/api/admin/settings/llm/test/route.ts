import { NextResponse } from "next/server";
import { testLlmConnection } from "@/lib/llm-client";
import { getSessionUser, isAdmin } from "@/lib/auth";

export async function POST() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await testLlmConnection();
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(result, { status: 400 });
}
