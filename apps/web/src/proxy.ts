import { NextResponse, type NextRequest } from "next/server";

import { verifyBetaPass } from "@/lib/beta-pass";
import { SITE_LIVE } from "@/lib/site-live";

// Waitlist launch: only the home route is reachable. Everything else
// (chat, profile, sign-in, sign-up, ...) bounces back to "/" — unless the
// site is live, or the request carries a valid beta pass. The /beta unlock
// page stays reachable so a beta user can land there from a bad/expired link.
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/beta") {
    return NextResponse.next();
  }
  if (SITE_LIVE || (await hasValidBetaPass(request))) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/", request.url));
}

// Verify the signed beta-pass cookie at the edge — no Convex round-trip.
async function hasValidBetaPass(request: NextRequest): Promise<boolean> {
  const secret = process.env.BETA_SECRET;
  const pass = request.cookies.get("beta_pass")?.value;
  if (!secret || !pass) return false;
  return (await verifyBetaPass(pass, { secret })) !== null;
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
