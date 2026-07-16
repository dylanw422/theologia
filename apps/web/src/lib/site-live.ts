// Deploy-time switch for the waitlist launch. Set NEXT_PUBLIC_SITE_LIVE=true
// to open the full site (auth pages, chat, checkout). Unset or any other
// value keeps the waitlist-only landing page. NEXT_PUBLIC_ vars are inlined
// at build time, so flipping this requires a rebuild/redeploy.
export const SITE_LIVE = process.env.NEXT_PUBLIC_SITE_LIVE === "true";
