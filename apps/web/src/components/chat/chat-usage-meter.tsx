"use client";

import { CheckoutLink } from "@convex-dev/polar/react";
import { api } from "@theologia/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

import styles from "./chat-usage-meter.module.css";

const RADIUS = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

export default function ChatUsageMeter() {
  const usage = useQuery(api.usage.getUsage);
  const products = useQuery(api.polar.getConfiguredProducts);

  // Countdown depends on client time — compute after mount to avoid a
  // server/client hydration mismatch, then tick every minute.
  const resetsAt = usage?.resetsAt;
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (resetsAt === undefined) return;
    function tick() {
      setCountdown(formatCountdown(resetsAt! - Date.now()));
    }
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [resetsAt]);

  if (!usage) return null;

  const fraction =
    usage.kind === "queries"
      ? Math.min(usage.used / usage.limit, 1)
      : Math.min(usage.usedUsd / usage.weeklyBudgetUsd, 1);
  const percent = Math.round(fraction * 100);
  const atLimit = fraction >= 1;

  const cardLabel =
    usage.kind === "queries" ? "Monthly queries" : "Weekly usage";
  const cardValue =
    usage.kind === "queries" ? `${usage.used} / ${usage.limit}` : `${percent}%`;

  const upgradeIds =
    usage.planId !== "churchTeam" && products
      ? [products.scholar, products.ministry, products.churchTeam]
          .filter((p) => p != null)
          .map((p) => p.id)
      : [];

  return (
    <div className={styles.meter}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={`${cardLabel}: ${cardValue} used, resets in ${countdown}`}
      >
        <svg viewBox="0 0 20 20" className={styles.ring} aria-hidden="true">
          <circle className={styles.track} cx="10" cy="10" r={RADIUS} />
          <circle
            className={styles.progress}
            cx="10"
            cy="10"
            r={RADIUS}
            strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            transform="rotate(-90 10 10)"
          />
        </svg>
      </button>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardLabel}>{cardLabel}</span>
          <span className={styles.percent}>{cardValue}</span>
        </div>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.reset}>
          {usage.planLabel} plan · Resets in {countdown}
        </span>
        {atLimit ? (
          <span className={styles.limit}>
            Limit reached — upgrade or wait for the reset.
          </span>
        ) : null}
        {upgradeIds.length > 0 ? (
          <CheckoutLink
            polarApi={api.polar}
            productIds={upgradeIds}
            className={styles.upgrade}
          >
            Upgrade
          </CheckoutLink>
        ) : null}
      </div>
    </div>
  );
}
