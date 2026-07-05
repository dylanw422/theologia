"use client";

import { ChevronDown } from "lucide-react";

import { FRAMEWORKS } from "./lib/frameworks";
import styles from "./framework-picker.module.css";

/**
 * Compact tradition selector, styled as a chip so it can live inside the
 * composer's context row.
 */
export default function FrameworkPicker({
  framework,
  onFrameworkChange,
}: {
  framework: string;
  onFrameworkChange: (id: string) => void;
}) {
  return (
    <span
      className={`${styles.chip} ${framework ? styles.chipSet : ""}`}
    >
      <select
        className={styles.select}
        value={framework}
        onChange={(event) => onFrameworkChange(event.target.value)}
        aria-label="Tradition"
      >
        <option value="" disabled>
          Tradition…
        </option>
        {FRAMEWORKS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <ChevronDown className={styles.caret} size={12} aria-hidden />
    </span>
  );
}
