"use client";

import { CheckoutLink } from "@convex-dev/polar/react";
import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";

import styles from "./chat-upgrade-banner.module.css";

export default function ChatUpgradeBanner({
  variant = "overlay",
}: {
  /** "overlay" pins to the top of the chat pane; "inline" flows inside the
   * thread column below the title bar. */
  variant?: "overlay" | "inline";
}) {
  const usage = useQuery(api.usage.getUsage);
  const products = useQuery(api.polar.getConfiguredProducts);

  if (usage?.planId !== "free") return null;

  const productIds = products
    ? [products.scholar, products.ministry, products.churchTeam]
        .filter((p) => p != null)
        .map((p) => p.id)
    : [];

  return (
    <div className={`${styles.banner} ${styles[variant]}`}>
      <span>You&rsquo;re on the Free plan — upgrade for increased usage.</span>
      {productIds.length > 0 ? (
        <CheckoutLink
          polarApi={api.polar}
          productIds={productIds}
          className={styles.cta}
        >
          Upgrade
        </CheckoutLink>
      ) : null}
    </div>
  );
}
