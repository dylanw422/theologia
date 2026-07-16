import { ConvexHttpClient } from "convex/browser";
import { NextResponse, type NextRequest } from "next/server";

import { api } from "@theologia/backend/convex/_generated/api";
import { env } from "@theologia/env/web";

import { signBetaPass } from "@/lib/beta-pass";

// Target of the personal magic link. Validates the token against Convex once,
// then mints the signed beta-pass cookie the middleware trusts thereafter.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const secret = process.env.BETA_SECRET;
  const invalid = NextResponse.redirect(
    new URL("/beta?error=invalid", request.url),
  );
  if (!token || !secret) return invalid;

  const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
  const result = await convex.query(api.waitlist.resolveBetaToken, { token });
  if (!result) return invalid;

  const expiresAt = Date.now() + THIRTY_DAYS_MS;
  const pass = await signBetaPass(result.email, { secret, expiresAt });

  const response = NextResponse.redirect(new URL("/sign-in", request.url));
  const base = {
    path: "/",
    sameSite: "lax" as const,
    // Secure would be dropped by the browser over http://localhost in dev.
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt),
  };
  // beta_pass: the security gate — HttpOnly + signed, verified in middleware.
  response.cookies.set("beta_pass", pass, { ...base, httpOnly: true });
  // beta_ui: cosmetic hint so client components can render the live UI.
  response.cookies.set("beta_ui", "1", { ...base, httpOnly: false });
  return response;
}
