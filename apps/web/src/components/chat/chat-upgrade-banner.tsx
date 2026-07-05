"use client";

import { CheckoutLink } from "@convex-dev/polar/react";
import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";

import styles from "./chat-upgrade-banner.module.css";

export default function ChatUpgradeBanner({
  belowHeader = false,
}: {
  /** Offset below the thread title bar instead of hugging the top edge. */
  belowHeader?: boolean;
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
    <div
      className={
        belowHeader ? `${styles.banner} ${styles.belowHeader}` : styles.banner
      }
    >
      <span>
        You&rsquo;re on the Free plan — upgrade for increased usage and better
        outputs.
      </span>
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
