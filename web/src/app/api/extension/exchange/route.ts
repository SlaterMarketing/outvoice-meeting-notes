import { db } from "@/db";
import { extensionChromeAuthCodes, extensionTokens } from "@/db/schema";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sha256Hex } from "@/lib/crypto";

/** Exchange one-time code from chrome.identity redirect for a long-lived capture token. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const code =
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof (body as { code: unknown }).code === "string"
      ? (body as { code: string }).code.trim()
      : "";

  if (!code) {
    return NextResponse.json({ error: "Code required." }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(extensionChromeAuthCodes)
    .where(
      and(
        eq(extensionChromeAuthCodes.code, code),
        isNull(extensionChromeAuthCodes.consumedAt),
        gt(extensionChromeAuthCodes.expiresAt, new Date())
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
  }

  await db
    .update(extensionChromeAuthCodes)
    .set({ consumedAt: new Date() })
    .where(eq(extensionChromeAuthCodes.id, row.id));

  const accessToken = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(accessToken);
  await db.insert(extensionTokens).values({
    id: nanoid(),
    userId: row.userId,
    tokenHash,
    label: "browser-sso",
  });

  return NextResponse.json({ accessToken });
}
