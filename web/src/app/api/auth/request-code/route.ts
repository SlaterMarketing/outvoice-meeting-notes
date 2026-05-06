import { db } from "@/db";
import { loginCodes } from "@/db/schema";
import { sendLoginCodeEmail } from "@/lib/email";
import { randomSixDigitCode } from "@/lib/crypto";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof (body as { email: unknown }).email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const code = randomSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(loginCodes).values({
    id: nanoid(),
    email,
    codeHash,
    expiresAt,
  });

  const sent = await sendLoginCodeEmail(email, code);
  if (!sent.ok && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Could not send email. Try again later." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    ...(sent.ok ? {} : { devCode: sent.devCode }),
  });
}
