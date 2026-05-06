import { db } from "@/db";
import { loginCodes, users } from "@/db/schema";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { and, desc, eq, gt, isNull } from "drizzle-orm";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const emailRaw = (body as { email?: unknown }).email;
  const codeRaw = (body as { code?: unknown }).code;
  const email =
    typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const code = typeof codeRaw === "string" ? codeRaw.trim() : "";

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code required." }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.email, email),
        isNull(loginCodes.consumedAt),
        gt(loginCodes.expiresAt, new Date())
      )
    )
    .orderBy(desc(loginCodes.expiresAt))
    .limit(5);

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
    .update(loginCodes)
    .set({ consumedAt: new Date() })
    .where(eq(loginCodes.id, matched.id));

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let userId: string;
  if (!existing[0]) {
    userId = nanoid();
    await db.insert(users).values({ id: userId, email });
  } else {
    userId = existing[0].id;
  }

  const token = await createSessionToken({ sub: userId, email });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
