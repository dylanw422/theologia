"use client";

import { ArrowUp } from "lucide-react";
import { useRef, useState } from "react";

import styles from "./chat-composer.module.css";

const MAX_INPUT_HEIGHT = 200;

export default function ChatComposer({
  onSend,
  disabled = false,
  placeholder = "Ask a question…",
  autoFocus = false,
  context,
  contextFirst = false,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Rendered in the card's bottom row — tradition chips, locked framework, etc. */
  context?: React.ReactNode;
  /** Place the context above the input — for when it gates sending. */
  contextFirst?: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !disabled;

  function autogrow() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }

  function submit() {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
    const el = inputRef.current;
    if (el) el.style.height = "auto";
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      className={styles.card}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {contextFirst && context ? (
        <div className={styles.contextTop}>{context}</div>
      ) : null}
      <textarea
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          autogrow();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        autoFocus={autoFocus}
        aria-label="Ask a question"
      />
      <div className={styles.row}>
        <div className={styles.context}>{contextFirst ? null : context}</div>
        <div className={styles.actions}>
          <span className={styles.hint} aria-hidden>
            ↵ Enter to send
          </span>
          <button
            type="submit"
            className={styles.send}
            disabled={!canSend}
            aria-label="Send message"
          >
            <ArrowUp size={15} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </form>
  );
}
