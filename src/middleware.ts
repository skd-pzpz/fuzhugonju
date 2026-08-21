import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isAuthPage = nextUrl.pathname === "/login";
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isPublicApiRoute = nextUrl.pathname === "/api/register";

  if (isApiAuthRoute || isPublicApiRoute) return NextResponse.next();

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/workspace", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};