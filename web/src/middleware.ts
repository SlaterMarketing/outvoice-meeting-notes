import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin") ?? "";
  const isExtension =
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://");

  if (request.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (isExtension) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
      res.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      res.headers.set("Access-Control-Max-Age", "86400");
    }
    return res;
  }

  const res = NextResponse.next();
  if (isExtension) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
