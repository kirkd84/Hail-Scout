import { NextRequest, NextResponse } from "next/server";

/**
 * Coarse auth gate for the app + super-admin sections. Only checks for the
 * presence of the session (refresh) cookie — real verification happens at the
 * API on every call, and pages further check is_super_admin via /v1/me. This
 * just keeps unauthenticated users from landing on a blank app shell.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.get("hs_refresh");
  if (hasSession) return NextResponse.next();

  const url = new URL("/sign-in", req.url);
  url.searchParams.set("redirect_url", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/super-admin/:path*"],
};
