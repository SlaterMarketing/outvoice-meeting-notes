import { db } from "@/db";
import { extensionPairingCodes } from "@/db/schema";
import { getSession } from "@/lib/session";
import { randomSixDigitCode } from "@/lib/crypto";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

/** Create a short-lived code to paste into the capture helper (browser). */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const code = randomSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(extensionPairingCodes).values({
    id: nanoid(),
    userId: session.sub,
    codeHash,
    expiresAt,
  });

  return NextResponse.json({ code, expiresInMinutes: 10 });
}
