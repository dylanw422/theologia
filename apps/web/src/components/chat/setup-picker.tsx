"use client";

import { ChevronDown, X } from "lucide-react";

import FrameworkPicker from "./framework-picker";
import type { ConversationSetup, ModeId } from "./lib/chat-state";
import { FRAMEWORKS, getFramework } from "./lib/frameworks";
import { COLLECTIONS, DOCUMENTS, PURPOSES, getMode } from "./lib/modes";
import styles from "./setup-picker.module.css";

const MAX_TRADITIONS = 4;

/** A single select rendered as a composer-context chip. */
function SelectChip({
  value,
  onChange,
  ariaLabel,
  placeholder,
  options,
  allowEmpty = false,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder: string;
  options: { id: string; label: string }[];
  allowEmpty?: boolean;
}) {
  return (
    <span className={`${styles.chip} ${value ? styles.chipSet : ""}`}>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
      >
        <option value="" disabled={!allowEmpty}>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className={styles.caret} size={12} aria-hidden />
    </span>
  );
}

/**
 * The composer's per-mode setup controls — which traditions, documents, or
 * collections frame the study. Locked once the conversation starts.
 */
export default function SetupPicker({
  mode,
  setup,
  onChange,
}: {
  mode: ModeId;
  setup: ConversationSetup;
  onChange: (setup: ConversationSetup) => void;
}) {
  const kind = getMode(mode).setup;

  function patch(partial: ConversationSetup) {
    onChange({ ...setup, ...partial });
  }

  const traditionPicker = (
    <FrameworkPicker
      framework={setup.framework ?? ""}
      onFrameworkChange={(id) =>
        patch({ framework: id, subTradition: undefined })
      }
    />
  );

  switch (kind) {
    case "tradition":
      return traditionPicker;

    case "versus":
      return (
        <>
          {traditionPicker}
          <span className={styles.versus} aria-hidden>
            vs
          </span>
          <SelectChip
            value={setup.opposing ?? ""}
            onChange={(id) => patch({ opposing: id || undefined })}
            ariaLabel="Opposing tradition"
            placeholder="Opposing tradition…"
            options={FRAMEWORKS.filter((f) => f.id !== setup.framework)}
          />
        </>
      );

    case "multi-tradition": {
      const traditions = setup.traditions ?? [];
      return (
        <>
          {traditions.map((id) => (
            <button
              key={id}
              type="button"
              className={styles.selected}
              onClick={() =>
                patch({ traditions: traditions.filter((t) => t !== id) })
              }
              aria-label={`Remove ${getFramework(id)?.label ?? id}`}
            >
              {getFramework(id)?.label ?? id}
              <X size={11} aria-hidden />
            </button>
          ))}
          {traditions.length < MAX_TRADITIONS && (
            <SelectChip
              value=""
              onChange={(id) =>
                id && patch({ traditions: [...traditions, id] })
              }
              ariaLabel="Add tradition"
              placeholder={
                traditions.length === 0
                  ? "Add traditions (2–4)…"
                  : "Add tradition…"
              }
              options={FRAMEWORKS.filter((f) => !traditions.includes(f.id))}
            />
          )}
        </>
      );
    }

    case "document":
      return (
        <SelectChip
          value={setup.document ?? ""}
          onChange={(id) => patch({ document: id || undefined })}
          ariaLabel="Confessional document"
          placeholder="Choose a document…"
          options={DOCUMENTS}
        />
      );

    case "collection":
      return (
        <SelectChip
          value={setup.collection ?? ""}
          onChange={(id) => patch({ collection: id || undefined })}
          ariaLabel="Library collection"
          placeholder="All collections"
          options={COLLECTIONS}
          allowEmpty
        />
      );

    case "tradition-purpose":
      return (
        <>
          {traditionPicker}
          <SelectChip
            value={setup.purpose ?? ""}
            onChange={(id) => patch({ purpose: id || undefined })}
            ariaLabel="Study purpose"
            placeholder="Purpose…"
            options={PURPOSES}
          />
        </>
      );
  }
}
