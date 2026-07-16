import { useEffect, useState } from "react";

import { SITE_LIVE } from "./site-live";

// Is this visitor a beta-pass holder? Reads the non-sensitive `beta_ui` cookie
// after mount (the real gate is the HttpOnly `beta_pass` cookie enforced in
// middleware; this only decides what the UI renders). A brief false-on-first-
// paint flash is acceptable for the beta window.
export function useIsBeta(): boolean {
  const [beta, setBeta] = useState(false);
  useEffect(() => {
    setBeta(document.cookie.split("; ").some((c) => c === "beta_ui=1"));
  }, []);
  return beta;
}

// Runtime access signal for client components: the site is globally live, OR
// this visitor holds a beta pass.
export function useSiteAccess(): boolean {
  const isBeta = useIsBeta();
  return SITE_LIVE || isBeta;
}
