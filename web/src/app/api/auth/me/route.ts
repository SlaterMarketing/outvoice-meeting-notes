import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: s.sub, email: s.email } });
}
