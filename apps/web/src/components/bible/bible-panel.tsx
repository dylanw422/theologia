"use client";

import { ChevronLeft, ChevronRight, MessageSquarePlus, X } from "lucide-react";
import { useEffect, useState } from "react";

import ChipSelect from "@/components/chip-select";

import { BOOKS, getBook, nextChapter, prevChapter } from "./lib/books";
import {
  DEFAULT_READER_STATE,
  READER_STATE_KEY,
  TRANSLATIONS,
  parseReaderState,
  type ReaderState,
  type TranslationId,
} from "./lib/reader-state";
import { useChapter } from "./lib/use-chapter";
import { buildVerseContext, buildVerseToken } from "./lib/verse-context";
import styles from "./bible-panel.module.css";

export default function BiblePanel({
  onClose,
  onSendToChat,
}: {
  onClose: () => void;
  onSendToChat: (insert: { token: string; context: string }) => void;
}) {
  // The panel only mounts on user interaction (post-hydration), so reading
  // localStorage in the initializer is safe; the guard covers SSR just in case.
  const [reader, setReader] = useState<ReaderState>(() =>
    typeof window === "undefined"
      ? DEFAULT_READER_STATE
      : parseReaderState(window.localStorage.getItem(READER_STATE_KEY)),
  );

  useEffect(() => {
    window.localStorage.setItem(READER_STATE_KEY, JSON.stringify(reader));
  }, [reader]);

  const { status, verses, retry } = useChapter(
    reader.translation,
    reader.book,
    reader.chapter,
  );

  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const chapterKey = `${reader.translation}/${reader.book}/${reader.chapter}`;
  useEffect(() => {
    setSelected(new Set());
  }, [chapterKey]);

  const book = getBook(reader.book) ?? BOOKS[0];
  const prev = prevChapter({ book: reader.book, chapter: reader.chapter });
  const next = nextChapter({ book: reader.book, chapter: reader.chapter });

  function goTo(ref: { book: string; chapter: number } | null) {
    if (ref === null) return;
    setReader((r) => ({ ...r, book: ref.book, chapter: ref.chapter }));
  }

  function toggleVerse(n: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) {
        next.delete(n);
      } else {
        next.add(n);
      }
      return next;
    });
  }

  const selectedNums = [...selected].sort((a, b) => a - b);
  const selectionToken =
    selectedNums.length > 0
      ? buildVerseToken(reader.book, reader.chapter, selectedNums)
      : null;

  function sendSelection() {
    if (selectedNums.length === 0) return;
    const translation =
      TRANSLATIONS.find((t) => t.id === reader.translation)?.label ??
      reader.translation;
    onSendToChat({
      token: buildVerseToken(reader.book, reader.chapter, selectedNums),
      context: buildVerseContext({
        book: reader.book,
        chapter: reader.chapter,
        verses: verses.filter((v) => selected.has(v.verse)),
        translation,
      }),
    });
    setSelected(new Set());
    // On small screens the panel is a fullscreen overlay (see module CSS
    // breakpoint) that hides the composer — close it to reveal the token.
    if (window.matchMedia("(max-width: 760px)").matches) onClose();
  }

  return (
    <aside className={styles.panel} aria-label="Bible reader">
      <header className={styles.head}>
        <ChipSelect
          className={styles.bookChip}
          value={reader.book}
          onChange={(id) =>
            setReader((r) => ({ ...r, book: id, chapter: 1 }))
          }
          ariaLabel="Book"
          options={BOOKS.map((b) => ({ id: b.name, label: b.name }))}
        />
        <ChipSelect
          value={String(reader.chapter)}
          onChange={(id) => setReader((r) => ({ ...r, chapter: Number(id) }))}
          ariaLabel="Chapter"
          options={Array.from({ length: book.chapters }, (_, i) => ({
            id: String(i + 1),
            label: String(i + 1),
          }))}
        />
        <ChipSelect
          value={reader.translation}
          onChange={(id) =>
            setReader((r) => ({ ...r, translation: id as TranslationId }))
          }
          ariaLabel="Translation"
          options={[...TRANSLATIONS]}
        />
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close Bible reader"
        >
          <X size={15} />
        </button>
      </header>

      {/* Keyed by position so the scroll resets when the chapter changes */}
      <div className={styles.body} key={`${reader.book}-${reader.chapter}`}>
        {status === "loading" ? (
          <div className={styles.loading} aria-label="Loading chapter">
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : null}

        {status === "error" ? (
          <div className={styles.error}>
            <p>Couldn&apos;t load this chapter.</p>
            <button type="button" className={styles.retry} onClick={retry}>
              Try again
            </button>
          </div>
        ) : null}

        {status === "loaded" ? (
          <>
            <h2 className={styles.reference}>
              {reader.book} {reader.chapter}
            </h2>
            {verses.map((v) => (
              <button
                key={v.verse}
                type="button"
                className={`${styles.verse}${selected.has(v.verse) ? ` ${styles.verseSelected}` : ""}`}
                aria-pressed={selected.has(v.verse)}
                onClick={() => toggleVerse(v.verse)}
              >
                <sup className={styles.verseNum}>{v.verse}</sup>
                {v.text}
              </button>
            ))}
          </>
        ) : null}
      </div>

      {selectionToken !== null ? (
        <div className={styles.selectionBar}>
          <span className={styles.selectionRef}>{selectionToken}</span>
          <button
            type="button"
            className={styles.sendToChat}
            onClick={sendSelection}
          >
            <MessageSquarePlus size={13} />
            Send to chat
          </button>
          <button
            type="button"
            className={styles.clearSelection}
            onClick={() => setSelected(new Set())}
            aria-label="Clear verse selection"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}

      <footer className={styles.foot}>
        <button
          type="button"
          className={styles.nav}
          disabled={prev === null}
          onClick={() => goTo(prev)}
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <button
          type="button"
          className={styles.nav}
          disabled={next === null}
          onClick={() => goTo(next)}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </footer>
    </aside>
  );
}
