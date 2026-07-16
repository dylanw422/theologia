"use client";

import { Lock } from "lucide-react";

import type { PlanId } from "@theologia/backend/convex/lib/plans";

import type { ModeId } from "./lib/chat-state";
import { isModeAllowedForPlan, MODES, type Mode } from "./lib/modes";
import ModeInfoDialog from "./mode-info-dialog";
import styles from "./mode-picker.module.css";

/** The picker breaks to a second line starting at this mode. */
const BREAK_AT: ModeId = "scripture-study";

/** The study-mode selector on the new-study screen. Modes above the
 * current plan stay selectable (so the copy still sells the upgrade) but
 * are marked locked; ChatEmpty blocks sending until the user upgrades. */
export default function ModePicker({
  mode,
  planId,
  onChange,
}: {
  mode: ModeId;
  planId: PlanId;
  onChange: (mode: ModeId) => void;
}) {
  const breakIndex = MODES.findIndex((m) => m.id === BREAK_AT);

  function chip(m: Mode) {
    const isActive = m.id === mode;
    const locked = !isModeAllowedForPlan(m.id, planId);
    return (
      <button
        key={m.id}
        type="button"
        role="tab"
        aria-selected={isActive}
        className={`${styles.chip} ${isActive ? styles.chipActive : ""} ${locked ? styles.chipLocked : ""}`}
        onClick={() => onChange(m.id)}
      >
        {locked ? <Lock size={10} aria-hidden /> : null}
        {m.label}
      </button>
    );
  }

  return (
    <div className={styles.stack} role="tablist" aria-label="Study mode">
      <div className={styles.line}>{MODES.slice(0, breakIndex).map(chip)}</div>
      <div className={styles.line}>
        {MODES.slice(breakIndex).map(chip)}
        <ModeInfoDialog />
      </div>
    </div>
  );
}
