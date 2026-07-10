"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { findTokenRange } from "./lib/token-ranges";
import styles from "./chat-composer.module.css";

const MAX_INPUT_HEIGHT = 200;

/** A "send to chat" insertion from the Bible reader: `token` is typed into
 *  the input (e.g. "[Matt. 6:1-6]"); `context` is the verse text appended to
 *  the outgoing message if the token is still present when sending. */
export interface ComposerInsert {
  id: number;
  token: string;
  context: string;
}

export default function ChatComposer({
  onSend,
  disabled = false,
  placeholder = "Ask a question…",
  autoFocus = false,
  context,
  contextFirst = false,
  insert = null,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Rendered in the card's bottom row — tradition chips, locked framework, etc. */
  context?: React.ReactNode;
  /** Place the context above the input — for when it gates sending. */
  contextFirst?: boolean;
  insert?: ComposerInsert | null;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const appliedInsertId = useRef(0);
  const verseContexts = useRef(new Map<string, string>());
  const canSend = value.trim().length > 0 && !disabled;

  function autogrow() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }

  useEffect(() => {
    if (insert === null || insert.id === appliedInsertId.current) return;
    appliedInsertId.current = insert.id;
    verseContexts.current.set(insert.token, insert.context);
    setValue((v) =>
      v.length === 0 || v.endsWith(" ") || v.endsWith("\n")
        ? `${v}${insert.token} `
        : `${v} ${insert.token} `,
    );
    inputRef.current?.focus();
  }, [insert]);

  // Covers programmatic value changes (verse inserts); typing already
  // autogrows via onChange.
  useEffect(autogrow, [value]);

  function submit() {
    if (!canSend) return;
    const text = value.trim();
    // Deleting a token from the input cancels its verse context.
    const blocks = [...verseContexts.current.entries()]
      .filter(([token]) => text.includes(token))
      .map(([, block]) => block);
    verseContexts.current.clear();
    onSend(blocks.length > 0 ? `${text}\n\n${blocks.join("\n\n")}` : text);
    setValue("");
    const el = inputRef.current;
    if (el) el.style.height = "auto";
  }

  // Verse tokens act as atomic chips: a caret touching one selects the whole
  // token (native highlight), so backspace or typing replaces all of it.
  const suppressAutoSelect = useRef(false);

  function handleSelect() {
    const el = inputRef.current;
    if (!el) return;
    if (suppressAutoSelect.current) {
      suppressAutoSelect.current = false;
      return;
    }
    if (el.selectionStart !== el.selectionEnd) return;
    const range = findTokenRange(
      el.value,
      verseContexts.current.keys(),
      el.selectionStart,
    );
    if (range !== null) el.setSelectionRange(range.start, range.end);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
      return;
    }

    const el = event.currentTarget;
    const collapsed = el.selectionStart === el.selectionEnd;

    // Arrow keys and space step out of a selected token instead of
    // re-selecting or replacing it.
    if (
      !collapsed &&
      (event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === " ")
    ) {
      const range = findTokenRange(
        el.value,
        verseContexts.current.keys(),
        el.selectionStart,
      );
      if (range?.start === el.selectionStart && range.end === el.selectionEnd) {
        event.preventDefault();
        if (event.key === "ArrowLeft") {
          suppressAutoSelect.current = true;
          el.setSelectionRange(range.start, range.start);
          return;
        }
        // ArrowRight / space land past a space after the token (adding one
        // if needed) so typing continues as ordinary text.
        const after = range.end + 1;
        if (el.value[range.end] === " ") {
          el.setSelectionRange(after, after);
        } else {
          setValue(
            `${el.value.slice(0, range.end)} ${el.value.slice(range.end)}`,
          );
          requestAnimationFrame(() => el.setSelectionRange(after, after));
        }
      }
      return;
    }

    // Backspace with the caret inside or at the end of a token removes the
    // whole token in one keystroke.
    if (event.key === "Backspace" && collapsed) {
      const pos = el.selectionStart;
      const range = findTokenRange(el.value, verseContexts.current.keys(), pos);
      if (range !== null && pos > range.start) {
        event.preventDefault();
        setValue(el.value.slice(0, range.start) + el.value.slice(range.end));
        requestAnimationFrame(() => {
          el.setSelectionRange(range.start, range.start);
        });
      }
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
        onSelect={handleSelect}
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
