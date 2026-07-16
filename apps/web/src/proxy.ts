import { NextResponse, type NextRequest } from "next/server";

// Waitlist launch: only the home route is reachable. Everything else
// (chat, profile, sign-in, sign-up, ...) bounces back to "/".
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    // Exclude anything with a file extension so static assets under
    // /public (images, etc.) aren't redirected along with real pages.
    // opengraph-image/twitter-image are extension-less metadata routes
    // that need the same carve-out so social crawlers can fetch them.
    "/((?!$|_next/static|_next/image|api/|opengraph-image|twitter-image|.*\\..*).*)",
  ],
};
