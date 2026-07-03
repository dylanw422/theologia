import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { env } from "@theologia/env/web";
import { cookies } from "next/headers";

export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl: env.NEXT_PUBLIC_CONVEX_URL,
  convexSiteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
  // Decode the JWT from the session cookie locally instead of making an
  // outbound fetch to the Convex site on every server render. Without this,
  // each request (the root layout calls getToken) leaks async-hook/memory in
  // Turbopack dev — spiking RAM and eventually overflowing Node's async_hooks
  // Map ("Map maximum size exceeded"). Only refetches when the token is
  // missing or within the expiration tolerance of expiring.
  jwtCache: {
    enabled: true,
    isAuthError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      return /unauthenticated|not authenticated|invalid token|expired/i.test(
        message,
      );
    },
  },
});

/**
 * Server-side token for the root layout's SSR pass. Returns the cached JWT for
 * signed-in users (local cookie decode, no network) and `null` for anonymous
 * requests without ever calling `getToken()` — which would otherwise fetch the
 * Convex site on every logged-out render. The presence of a better-auth
 * `session_token` cookie (any prefix / chunk) is the source of truth for a live
 * session; when it's there but the Convex JWT is missing/expired, `getToken`'s
 * jwtCache refetches a fresh one.
 */
export async function getInitialToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const hasSession = cookieStore
    .getAll()
    .some((c) => c.name.includes("session_token"));
  if (!hasSession) return null;
  return (await getToken()) ?? null;
}
