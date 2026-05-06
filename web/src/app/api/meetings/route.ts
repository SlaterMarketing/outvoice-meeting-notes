import { db } from "@/db";
import { meetings } from "@/db/schema";
import { resolveWebOrExtensionUserId } from "@/lib/resolve-user";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const userId = await resolveWebOrExtensionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      platform: meetings.platform,
      status: meetings.status,
      createdAt: meetings.createdAt,
      updatedAt: meetings.updatedAt,
    })
    .from(meetings)
    .where(eq(meetings.userId, userId))
    .orderBy(desc(meetings.createdAt))
    .limit(100);

  return NextResponse.json({ meetings: rows });
}
