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
  try {
    await db.insert(extensionChromeAuthCodes).values({
      id: nanoid(),
      userId: session.sub,
      code: opaque,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
  } catch (e) {
    console.error("[extension/connect] insert extension_chrome_auth_codes failed", e);
    return new NextResponse(
      "Extension sign-in is not ready on this server yet. Use a connection code from Settings in your library, or try again after an update.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const target = new URL(redirectUri);
  target.searchParams.set("code", opaque);
  return NextResponse.redirect(target.toString());
}
