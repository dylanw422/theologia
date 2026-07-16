"use client";

import { useIsBeta } from "@/lib/use-site-access";
import styles from "./beta-badge.module.css";

/**
 * Small "BETA" emblem shown next to the Theologia wordmark for beta-pass
 * holders. Self-gating: renders nothing for everyone else, so it can be
 * dropped in beside any wordmark. Sized in `em` so it scales to whatever
 * wordmark it sits next to.
 */
export default function BetaBadge() {
  const isBeta = useIsBeta();
  if (!isBeta) return null;
  return (
    <span className={styles.badge} aria-label="Beta access">
      Beta
    </span>
  );
}
