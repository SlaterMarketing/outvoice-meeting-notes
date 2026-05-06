import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/** Optional BYO key for TTS.ai (stores per user). */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const raw = (body as { ttsaiApiKey?: unknown }).ttsaiApiKey;
  if (raw !== undefined && typeof raw !== "string") {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const ttsaiApiKey =
    raw === undefined ? undefined : raw.trim() === "" ? null : raw.trim();

  if (ttsaiApiKey !== undefined) {
    await db
      .update(users)
      .set({ ttsaiApiKey })
      .where(eq(users.id, session.sub));
  }

  return NextResponse.json({ ok: true });
}
