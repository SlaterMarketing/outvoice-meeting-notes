import { db } from "@/db";
import { meetings } from "@/db/schema";
import { getSession } from "@/lib/session";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.userId, session.sub)))
    .limit(1);
  const m = row[0];
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let summary: unknown = null;
  if (m.summaryJson) {
    try {
      summary = JSON.parse(m.summaryJson) as unknown;
    } catch {
      summary = null;
    }
  }

  return NextResponse.json({
    meeting: {
      id: m.id,
      title: m.title,
      platform: m.platform,
      status: m.status,
      transcript: m.transcript,
      summary,
      processingError: m.processingError,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    },
  });
}
