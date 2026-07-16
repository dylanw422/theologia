// Vercel sets VERCEL_PROJECT_PRODUCTION_URL to the project's canonical
// domain (custom domain if assigned, else *.vercel.app) in every
// environment, so URLs built from this resolve correctly even from
// preview deployments.
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3001";
