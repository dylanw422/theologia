"use client";

import { CheckoutLink } from "@convex-dev/polar/react";
import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";

import { MODE_MIN_PLAN, modeMinPlanLabel } from "./lib/modes";
import type { ModeId } from "./lib/chat-state";
import styles from "./mode-lock-notice.module.css";

/** Shown below the composer when the selected mode is above the user's
 * current plan; links straight to checkout for the tier that unlocks it. */
export default function ModeLockNotice({
  modeId,
  modeLabel,
}: {
  modeId: ModeId;
  modeLabel: string;
}) {
  const products = useQuery(api.polar.getConfiguredProducts);
  const requiredPlanId = MODE_MIN_PLAN[modeId];
  const requiredLabel = modeMinPlanLabel(modeId);

  const productIds =
    products && requiredPlanId !== "free"
      ? [products[requiredPlanId], products.churchTeam]
          .filter((p): p is NonNullable<typeof p> => p != null)
          .map((p) => p.id)
      : [];

  return (
    <div className={styles.notice}>
      <span>
        {modeLabel} requires the {requiredLabel} plan.
      </span>
      {productIds.length > 0 ? (
        <CheckoutLink
          polarApi={api.polar}
          productIds={productIds}
          className={styles.cta}
        >
          Upgrade to {requiredLabel}
        </CheckoutLink>
      ) : null}
    </div>
  );
}
