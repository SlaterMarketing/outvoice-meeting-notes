import { db } from "@/db";
import { extensionChromeAuthCodes } from "@/db/schema";
import { getSession } from "@/lib/session";
import { isAllowedChromeExtensionRedirect } from "@/lib/extension-chrome-auth";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const redirectUri = req.nextUrl.searchParams.get("redirect_uri");
  if (!redirectUri || !isAllowedChromeExtensionRedirect(redirectUri)) {
    return new NextResponse("Invalid or missing redirect_uri.", { status: 400 });
  }

  const session = await getSession();
  if (!session) {
    const login = new URL("/login", req.url);
    const back = new URL("/extension/connect", req.url);
    back.searchParams.set("redirect_uri", redirectUri);
    login.searchParams.set("next", `${back.pathname}${back.search}`);
    return NextResponse.redirect(login);
  }

  const opaque = nanoid(32);
  await db.insert(extensionChromeAuthCodes).values({
    id: nanoid(),
    userId: session.sub,
    code: opaque,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  const target = new URL(redirectUri);
  target.searchParams.set("code", opaque);
  return NextResponse.redirect(target.toString());
}
