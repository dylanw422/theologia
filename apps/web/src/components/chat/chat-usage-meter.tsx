"use client";

import { useEffect, useState } from "react";

import { MOCK_USAGE, nextWeeklyReset } from "./lib/mock-usage";
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
  const { plan, usedUsd } = MOCK_USAGE;
  const fraction = Math.min(usedUsd / plan.weeklyBudgetUsd, 1);
  const percent = Math.round(fraction * 100);

  // Countdown depends on client time — compute after mount to avoid a
  // server/client hydration mismatch, then tick every minute.
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    function tick() {
      setCountdown(formatCountdown(nextWeeklyReset().getTime() - Date.now()));
    }
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.meter}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={`Weekly usage: ${percent}% used, resets in ${countdown}`}
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

      <div className={styles.card} aria-hidden="true">
        <div className={styles.cardHead}>
          <span className={styles.cardLabel}>Weekly usage</span>
          <span className={styles.percent}>{percent}%</span>
        </div>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.reset}>Resets in {countdown}</span>
      </div>
    </div>
  );
}
