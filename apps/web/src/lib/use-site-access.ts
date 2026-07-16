import { useEffect, useState } from "react";

import { SITE_LIVE } from "./site-live";

// Runtime access signal for client components: the site is globally live, OR
// this visitor holds a beta pass. Reads the non-sensitive `beta_ui` cookie
// after mount — the real gate is the HttpOnly `beta_pass` cookie enforced in
// middleware, so this only decides what the UI renders. A brief non-beta flash
// on first paint is acceptable for the beta window.
export function useSiteAccess(): boolean {
  const [beta, setBeta] = useState(false);
  useEffect(() => {
    setBeta(
      document.cookie.split("; ").some((c) => c === "beta_ui=1"),
    );
  }, []);
  return SITE_LIVE || beta;
}
