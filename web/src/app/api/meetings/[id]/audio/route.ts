import { db } from "@/db";
import { meetings, users } from "@/db/schema";
import { resolveWebOrExtensionUserId } from "@/lib/resolve-user";
import { getTtsAiApiKey, transcribeAndSummarize } from "@/lib/ai";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await resolveWebOrExtensionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.userId, userId)))
    .limit(1);
  const meeting = row[0];
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ctype = req.headers.get("content-type") ?? "";
  if (!ctype.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart audio upload." }, { status: 400 });
  }

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Missing audio file field." }, { status: 400 });
  }

  const buf = Buffer.from(await audio.arrayBuffer());
  if (buf.length < 100) {
    return NextResponse.json({ error: "Recording too short." }, { status: 400 });
  }

  await db
    .update(meetings)
    .set({
      status: "processing",
      audioMime: audio.type || "audio/webm",
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, id));

  const u = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const ttsKey = getTtsAiApiKey(u[0]?.ttsaiApiKey);
  if (!ttsKey) {
    await db
      .update(meetings)
      .set({
        status: "failed",
        processingError:
          "No processing key configured. Add yours under Settings or ask your host to set one.",
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, id));
    return NextResponse.json(
      { error: "Processing is not configured for this account." },
      { status: 503 }
    );
  }

  try {
    const ext =
      meeting.platform === "meet"
        ? "webm"
        : meeting.platform === "zoom"
          ? "webm"
          : "webm";
    const { transcript, summary } = await transcribeAndSummarize(
      buf,
      audio.type || "audio/webm",
      `capture.${ext}`,
      ttsKey
    );

    await db
      .update(meetings)
      .set({
        status: "ready",
        transcript,
        summaryJson: JSON.stringify(summary),
        updatedAt: new Date(),
        processingError: null,
      })
      .where(eq(meetings.id, id));

    return NextResponse.json({ ok: true, meetingId: id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Processing failed";
    await db
      .update(meetings)
      .set({
        status: "failed",
        processingError: msg,
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, id));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
