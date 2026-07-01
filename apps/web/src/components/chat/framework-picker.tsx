"use client";

import { ChevronDown } from "lucide-react";

import { FRAMEWORKS, getFramework } from "./lib/frameworks";
import styles from "./framework-picker.module.css";

/**
 * Compact tradition selectors, styled as chips so they can live inside the
 * composer's context row.
 */
export default function FrameworkPicker({
  framework,
  subTradition,
  onFrameworkChange,
  onSubTraditionChange,
}: {
  framework: string;
  subTradition: string;
  onFrameworkChange: (id: string) => void;
  onSubTraditionChange: (id: string) => void;
}) {
  const subTraditions = getFramework(framework)?.subTraditions ?? [];

  return (
    <>
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

      {framework && subTraditions.length > 0 && (
        <span
          className={`${styles.chip} ${subTradition ? styles.chipSet : ""}`}
        >
          <select
            className={styles.select}
            value={subTradition}
            onChange={(event) => onSubTraditionChange(event.target.value)}
            aria-label="Sub-tradition"
          >
            <option value="">Any sub-tradition</option>
            {subTraditions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown className={styles.caret} size={12} aria-hidden />
        </span>
      )}
    </>
  );
}
