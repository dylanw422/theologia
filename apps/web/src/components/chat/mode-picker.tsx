"use client";

import type { ModeId } from "./lib/chat-state";
import { MODES, type Mode } from "./lib/modes";
import ModeInfoDialog from "./mode-info-dialog";
import styles from "./mode-picker.module.css";

/** The picker breaks to a second line starting at this mode. */
const BREAK_AT: ModeId = "scripture-study";

/** The study-mode selector on the new-study screen. */
export default function ModePicker({
  mode,
  onChange,
}: {
  mode: ModeId;
  onChange: (mode: ModeId) => void;
}) {
  const breakIndex = MODES.findIndex((m) => m.id === BREAK_AT);

  function chip(m: Mode) {
    const isActive = m.id === mode;
    return (
      <button
        key={m.id}
        type="button"
        role="tab"
        aria-selected={isActive}
        className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
        onClick={() => onChange(m.id)}
      >
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
