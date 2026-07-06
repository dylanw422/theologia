"use client";

import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";

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
import styles from "./bible-panel.module.css";

export default function BiblePanel({ onClose }: { onClose: () => void }) {
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

  const book = getBook(reader.book) ?? BOOKS[0];
  const prev = prevChapter({ book: reader.book, chapter: reader.chapter });
  const next = nextChapter({ book: reader.book, chapter: reader.chapter });

  function goTo(ref: { book: string; chapter: number } | null) {
    if (ref === null) return;
    setReader((r) => ({ ...r, book: ref.book, chapter: ref.chapter }));
  }

  return (
    <aside className={styles.panel} aria-label="Bible reader">
      <header className={styles.head}>
        <span className={`${styles.chip} ${styles.bookChip}`}>
          <select
            className={styles.select}
            value={reader.book}
            aria-label="Book"
            onChange={(e) =>
              setReader((r) => ({ ...r, book: e.target.value, chapter: 1 }))
            }
          >
            {BOOKS.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown className={styles.caret} size={12} aria-hidden />
        </span>
        <span className={styles.chip}>
          <select
            className={styles.select}
            value={reader.chapter}
            aria-label="Chapter"
            onChange={(e) =>
              setReader((r) => ({ ...r, chapter: Number(e.target.value) }))
            }
          >
            {Array.from({ length: book.chapters }, (_, i) => i + 1).map(
              (n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ),
            )}
          </select>
          <ChevronDown className={styles.caret} size={12} aria-hidden />
        </span>
        <span className={styles.chip}>
          <select
            className={styles.select}
            value={reader.translation}
            aria-label="Translation"
            onChange={(e) =>
              setReader((r) => ({
                ...r,
                translation: e.target.value as TranslationId,
              }))
            }
          >
            {TRANSLATIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown className={styles.caret} size={12} aria-hidden />
        </span>
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
              <p key={v.verse} className={styles.verse}>
                <sup className={styles.verseNum}>{v.verse}</sup>
                {v.text}
              </p>
            ))}
          </>
        ) : null}
      </div>

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
