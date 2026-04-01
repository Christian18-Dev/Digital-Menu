import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, verifySessionTokenSigned } from "@/lib/auth";

const PUBLIC_PATH_PREFIXES = [
  "/display",
  "/_next",
  "/uploads",
  "/favicon.ico",
  "/login",
  "/register",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }

  if (pathname.startsWith("/api")) {
    if (pathname.startsWith("/api/auth")) return true;
    if (pathname.startsWith("/api/socket")) return true;
    return false;
  }

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(getSessionCookieName())?.value;
  const session = await verifySessionTokenSigned(token);

  const isLoginRoute = pathname === "/login";

  if (!session && !isLoginRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && isLoginRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
