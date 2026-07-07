"use client";

import type { ModeId } from "./lib/chat-state";
import { MODES } from "./lib/modes";
import ModeInfoDialog from "./mode-info-dialog";
import styles from "./mode-picker.module.css";

/** The study-mode selector on the new-study screen. */
export default function ModePicker({
  mode,
  onChange,
}: {
  mode: ModeId;
  onChange: (mode: ModeId) => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.tabs} role="tablist" aria-label="Study mode">
        {MODES.map((m) => {
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
        })}
      </div>
      <ModeInfoDialog />
    </div>
  );
}
