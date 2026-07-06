"use client";

import ChipSelect from "@/components/chip-select";

import { FRAMEWORKS } from "./lib/frameworks";

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
    <ChipSelect
      value={framework}
      onChange={onFrameworkChange}
      ariaLabel="Tradition"
      placeholder="Tradition…"
      options={FRAMEWORKS}
    />
  );
}
