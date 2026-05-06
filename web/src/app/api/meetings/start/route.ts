import { db } from "@/db";
import { meetings } from "@/db/schema";
import { resolveWebOrExtensionUserId } from "@/lib/resolve-user";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

function detectPlatform(url: string | undefined) {
  if (!url) return "unknown";
  if (url.includes("meet.google.com")) return "meet";
  if (url.includes("zoom.us")) return "zoom";
  if (url.includes("teams.microsoft.com") || url.includes("teams.live.com"))
    return "teams";
  return "unknown";
}

export async function POST(req: Request) {
  const userId = await resolveWebOrExtensionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  const tabUrl = typeof body.tabUrl === "string" ? body.tabUrl : undefined;
  const title = typeof body.title === "string" ? body.title : undefined;
  const platform = detectPlatform(tabUrl);

  const id = nanoid();
  await db.insert(meetings).values({
    id,
    userId,
    title: title ?? null,
    platform,
    status: "recording",
  });

  return NextResponse.json({
    meetingId: id,
    platform,
  });
}
