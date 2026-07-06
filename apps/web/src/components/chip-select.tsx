"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

import styles from "./chip-select.module.css";

export interface ChipSelectOption {
  id: string;
  label: string;
}

function ChipItem({ value, label }: { value: string; label: string }) {
  return (
    <Select.Item value={value} className={styles.item}>
      <Select.ItemIndicator className={styles.indicator}>
        <Check size={11} aria-hidden />
      </Select.ItemIndicator>
      <Select.ItemText>{label}</Select.ItemText>
    </Select.Item>
  );
}

/** Chip-styled select with a custom popup (replaces native <select>). */
export default function ChipSelect({
  value,
  onChange,
  ariaLabel,
  options,
  placeholder,
  allowEmpty = false,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  options: ChipSelectOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
}) {
  const current = options.find((option) => option.id === value);

  return (
    <Select.Root
      value={value}
      onValueChange={(next) => onChange(typeof next === "string" ? next : "")}
    >
      <Select.Trigger
        className={`${styles.chip}${current ? ` ${styles.chipSet}` : ""}${className ? ` ${className}` : ""}`}
        aria-label={ariaLabel}
      >
        <span className={styles.label}>
          {current?.label ?? placeholder ?? ""}
        </span>
        <ChevronDown className={styles.caret} size={12} aria-hidden />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className={styles.positioner}
          align="start"
          sideOffset={4}
          alignItemWithTrigger={false}
        >
          <Select.Popup className={styles.popup}>
            {allowEmpty && placeholder ? (
              <ChipItem value="" label={placeholder} />
            ) : null}
            {options.map((option) => (
              <ChipItem
                key={option.id}
                value={option.id}
                label={option.label}
              />
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
