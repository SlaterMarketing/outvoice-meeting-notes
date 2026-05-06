import { db } from "@/db";
import { extensionPairingCodes, extensionTokens } from "@/db/schema";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { sha256Hex } from "@/lib/crypto";

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

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(extensionPairingCodes)
    .where(
      and(
        isNull(extensionPairingCodes.usedAt),
        gt(extensionPairingCodes.expiresAt, new Date())
      )
    )
    .orderBy(desc(extensionPairingCodes.expiresAt))
    .limit(20);

  let matched: (typeof rows)[0] | null = null;
  for (const row of rows) {
    const ok = await bcrypt.compare(code, row.codeHash);
    if (ok) {
      matched = row;
      break;
    }
  }

  if (!matched) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
  }

  await db
    .update(extensionPairingCodes)
    .set({ usedAt: new Date() })
    .where(eq(extensionPairingCodes.id, matched.id));

  const accessToken = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(accessToken);
  await db.insert(extensionTokens).values({
    id: nanoid(),
    userId: matched.userId,
    tokenHash,
    label: "browser",
  });

  return NextResponse.json({ accessToken });
}
