import { NextResponse, type NextRequest } from "next/server";

// Waitlist launch: only the home route is reachable. Everything else
// (chat, profile, sign-in, sign-up, ...) bounces back to "/".
export function middleware(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/((?!$|_next/static|_next/image|api/|favicon.ico).*)",
  ],
};
