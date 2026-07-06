# Bible Reader Side Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A book icon at the top-right of the chat screen toggles a Bible reader side panel that sits next to the chat thread.

**Architecture:** Panel open/closed state lives in `ChatApp`; when open, the chat shell grid gains a third column holding `BiblePanel`. The panel fetches chapters client-side from bible-api.com (keyless, public-domain translations), caches them in a session `Map`, and persists last-read position in `localStorage`. No backend/Convex changes.

**Tech Stack:** Next.js 16 app (`apps/web`), React 19 client components, CSS modules, lucide-react icons, vitest (node environment, colocated `*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-07-06-bible-reader-panel-design.md`

## Global Constraints

- All new files live under `apps/web/src/components/bible/`.
- Text source: `https://bible-api.com/{book}+{chapter}?translation={id}`; translations offered: WEB (`web`), KJV (`kjv`), ASV (`asv`). Default position: John 1, WEB.
- `localStorage` key: `theologia.bible-reader` (single JSON value). Corrupt/missing state falls back to the default silently.
- Desktop open-state grid: `clamp(240px, 22vw, 288px) minmax(0, 1fr) clamp(320px, 26vw, 400px)`. Below 760px the panel is a full-screen fixed overlay.
- Styling uses the chat's existing custom properties (`--parchment`, `--parchment-dim`, `--stone`, `--gold`, `--gold-bright`, `--hairline`, `--ink-deep`) — they are defined on `.root` in `chat-app.module.css` and inherit into the panel. Fonts: `var(--font-fraunces)` serif for reading text, `var(--font-geist-mono)` for labels/chips, matching `message-blocks.module.css`.
- Deviation from spec noted and accepted: the loading state uses pulsing placeholder lines in the panel's own CSS module (same pattern as `.typing` in `chat-thread.module.css`) instead of the `@theologia/ui` `Skeleton`, because that component is Tailwind-themed (`bg-muted`) and doesn't fit the chat's CSS-module token system.
- Tests run from `apps/web/`: `pnpm vitest run <file>`. Vitest uses the node environment, so only pure functions get unit tests — no DOM/hook tests.
- Commit after every task. Commit messages follow the repo's `feat(web):` / `fix(web):` convention.

---

### Task 1: Book metadata and chapter navigation (`lib/books.ts`)

**Files:**
- Create: `apps/web/src/components/bible/lib/books.ts`
- Test: `apps/web/src/components/bible/lib/books.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Tasks 2–4):
  - `interface Book { name: string; chapters: number }`
  - `interface ChapterRef { book: string; chapter: number }`
  - `const BOOKS: Book[]` — 66 books in canonical order
  - `getBook(name: string): Book | null`
  - `prevChapter(ref: ChapterRef): ChapterRef | null` — null at Genesis 1 or unknown book
  - `nextChapter(ref: ChapterRef): ChapterRef | null` — null at Revelation 22 or unknown book

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/bible/lib/books.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { BOOKS, getBook, nextChapter, prevChapter } from "./books";

describe("BOOKS", () => {
  test("contains the 66-book Protestant canon in order", () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS[0]).toEqual({ name: "Genesis", chapters: 50 });
    expect(BOOKS[65]).toEqual({ name: "Revelation", chapters: 22 });
  });

  test("getBook finds books by exact name", () => {
    expect(getBook("Psalms")?.chapters).toBe(150);
    expect(getBook("Song of Solomon")?.chapters).toBe(8);
    expect(getBook("Enoch")).toBeNull();
  });
});

describe("prevChapter", () => {
  test("steps back within a book", () => {
    expect(prevChapter({ book: "John", chapter: 3 })).toEqual({
      book: "John",
      chapter: 2,
    });
  });

  test("crosses into the previous book's last chapter", () => {
    expect(prevChapter({ book: "Matthew", chapter: 1 })).toEqual({
      book: "Malachi",
      chapter: 4,
    });
  });

  test("returns null at Genesis 1", () => {
    expect(prevChapter({ book: "Genesis", chapter: 1 })).toBeNull();
  });

  test("returns null for an unknown book", () => {
    expect(prevChapter({ book: "Enoch", chapter: 2 })).toBeNull();
  });
});

describe("nextChapter", () => {
  test("steps forward within a book", () => {
    expect(nextChapter({ book: "John", chapter: 3 })).toEqual({
      book: "John",
      chapter: 4,
    });
  });

  test("crosses into the next book's first chapter", () => {
    expect(nextChapter({ book: "Malachi", chapter: 4 })).toEqual({
      book: "Matthew",
      chapter: 1,
    });
  });

  test("returns null at Revelation 22", () => {
    expect(nextChapter({ book: "Revelation", chapter: 22 })).toBeNull();
  });

  test("returns null for an unknown book", () => {
    expect(nextChapter({ book: "Enoch", chapter: 2 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/web/`): `pnpm vitest run src/components/bible/lib/books.test.ts`
Expected: FAIL — cannot resolve `./books`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/bible/lib/books.ts`:

```ts
/** Protestant 66-book canon with chapter counts, in canonical order.
 *  Names match what bible-api.com accepts as references. */

export interface Book {
  name: string;
  chapters: number;
}

export interface ChapterRef {
  book: string;
  chapter: number;
}

export const BOOKS: Book[] = [
  { name: "Genesis", chapters: 50 },
  { name: "Exodus", chapters: 40 },
  { name: "Leviticus", chapters: 27 },
  { name: "Numbers", chapters: 36 },
  { name: "Deuteronomy", chapters: 34 },
  { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 },
  { name: "Ruth", chapters: 4 },
  { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 },
  { name: "1 Kings", chapters: 22 },
  { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 },
  { name: "2 Chronicles", chapters: 36 },
  { name: "Ezra", chapters: 10 },
  { name: "Nehemiah", chapters: 13 },
  { name: "Esther", chapters: 10 },
  { name: "Job", chapters: 42 },
  { name: "Psalms", chapters: 150 },
  { name: "Proverbs", chapters: 31 },
  { name: "Ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", chapters: 8 },
  { name: "Isaiah", chapters: 66 },
  { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 },
  { name: "Ezekiel", chapters: 48 },
  { name: "Daniel", chapters: 12 },
  { name: "Hosea", chapters: 14 },
  { name: "Joel", chapters: 3 },
  { name: "Amos", chapters: 9 },
  { name: "Obadiah", chapters: 1 },
  { name: "Jonah", chapters: 4 },
  { name: "Micah", chapters: 7 },
  { name: "Nahum", chapters: 3 },
  { name: "Habakkuk", chapters: 3 },
  { name: "Zephaniah", chapters: 3 },
  { name: "Haggai", chapters: 2 },
  { name: "Zechariah", chapters: 14 },
  { name: "Malachi", chapters: 4 },
  { name: "Matthew", chapters: 28 },
  { name: "Mark", chapters: 16 },
  { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 },
  { name: "Acts", chapters: 28 },
  { name: "Romans", chapters: 16 },
  { name: "1 Corinthians", chapters: 16 },
  { name: "2 Corinthians", chapters: 13 },
  { name: "Galatians", chapters: 6 },
  { name: "Ephesians", chapters: 6 },
  { name: "Philippians", chapters: 4 },
  { name: "Colossians", chapters: 4 },
  { name: "1 Thessalonians", chapters: 5 },
  { name: "2 Thessalonians", chapters: 3 },
  { name: "1 Timothy", chapters: 6 },
  { name: "2 Timothy", chapters: 4 },
  { name: "Titus", chapters: 3 },
  { name: "Philemon", chapters: 1 },
  { name: "Hebrews", chapters: 13 },
  { name: "James", chapters: 5 },
  { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 },
  { name: "1 John", chapters: 5 },
  { name: "2 John", chapters: 1 },
  { name: "3 John", chapters: 1 },
  { name: "Jude", chapters: 1 },
  { name: "Revelation", chapters: 22 },
];

export function getBook(name: string): Book | null {
  return BOOKS.find((b) => b.name === name) ?? null;
}

export function prevChapter(ref: ChapterRef): ChapterRef | null {
  const index = BOOKS.findIndex((b) => b.name === ref.book);
  if (index === -1) return null;
  if (ref.chapter > 1) return { book: ref.book, chapter: ref.chapter - 1 };
  const prev = BOOKS[index - 1];
  if (prev === undefined) return null;
  return { book: prev.name, chapter: prev.chapters };
}

export function nextChapter(ref: ChapterRef): ChapterRef | null {
  const index = BOOKS.findIndex((b) => b.name === ref.book);
  if (index === -1) return null;
  if (ref.chapter < BOOKS[index].chapters) {
    return { book: ref.book, chapter: ref.chapter + 1 };
  }
  const next = BOOKS[index + 1];
  if (next === undefined) return null;
  return { book: next.name, chapter: 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/bible/lib/books.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/bible/lib/books.ts apps/web/src/components/bible/lib/books.test.ts
git commit -m "feat(web): Bible book metadata and chapter navigation"
```

---

### Task 2: Chapter fetching (`lib/use-chapter.ts`)

**Files:**
- Create: `apps/web/src/components/bible/lib/use-chapter.ts`
- Test: `apps/web/src/components/bible/lib/use-chapter.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (used by Task 4):
  - `interface Verse { verse: number; text: string }`
  - `parseChapterResponse(data: unknown): Verse[] | null` — pure; null on any malformed shape
  - `useChapter(translation: string, book: string, chapter: number): { status: "loading" | "loaded" | "error"; verses: Verse[]; retry: () => void }` — `verses` is `[]` unless status is `"loaded"`.

bible-api.com response shape (for reference):

```json
{
  "reference": "John 3",
  "verses": [
    { "book_id": "JHN", "book_name": "John", "chapter": 3, "verse": 1, "text": "Now there was a man...\n" }
  ],
  "text": "...",
  "translation_id": "web"
}
```

- [ ] **Step 1: Write the failing test**

Only the pure parser is unit-tested (vitest runs in the node environment; the hook is exercised via the UI in Task 5). Create `apps/web/src/components/bible/lib/use-chapter.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { parseChapterResponse } from "./use-chapter";

const sample = {
  reference: "John 3",
  verses: [
    {
      book_id: "JHN",
      book_name: "John",
      chapter: 3,
      verse: 1,
      text: "Now there was a man of the Pharisees named Nicodemus,\na ruler of the Jews.\n",
    },
    {
      book_id: "JHN",
      book_name: "John",
      chapter: 3,
      verse: 2,
      text: "The same came to him by night,\n",
    },
  ],
  text: "…",
  translation_id: "web",
};

describe("parseChapterResponse", () => {
  test("extracts verse numbers and text", () => {
    expect(parseChapterResponse(sample)).toEqual([
      {
        verse: 1,
        text: "Now there was a man of the Pharisees named Nicodemus, a ruler of the Jews.",
      },
      { verse: 2, text: "The same came to him by night," },
    ]);
  });

  test("collapses internal whitespace and trims", () => {
    const parsed = parseChapterResponse({
      verses: [{ verse: 1, text: "  In the\n\nbeginning  " }],
    });
    expect(parsed).toEqual([{ verse: 1, text: "In the beginning" }]);
  });

  test("returns null for malformed responses", () => {
    expect(parseChapterResponse(null)).toBeNull();
    expect(parseChapterResponse("nope")).toBeNull();
    expect(parseChapterResponse({})).toBeNull();
    expect(parseChapterResponse({ verses: "x" })).toBeNull();
    expect(parseChapterResponse({ verses: [] })).toBeNull();
    expect(parseChapterResponse({ verses: [{ verse: "1", text: 2 }] })).toBeNull();
    expect(parseChapterResponse({ verses: [null] })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/bible/lib/use-chapter.test.ts`
Expected: FAIL — cannot resolve `./use-chapter`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/bible/lib/use-chapter.ts`:

```ts
import { useCallback, useEffect, useState } from "react";

export interface Verse {
  verse: number;
  text: string;
}

/** Verses from a bible-api.com chapter response; null on any malformed shape. */
export function parseChapterResponse(data: unknown): Verse[] | null {
  if (typeof data !== "object" || data === null) return null;
  const verses = (data as { verses?: unknown }).verses;
  if (!Array.isArray(verses) || verses.length === 0) return null;
  const out: Verse[] = [];
  for (const entry of verses) {
    if (typeof entry !== "object" || entry === null) return null;
    const { verse, text } = entry as { verse?: unknown; text?: unknown };
    if (typeof verse !== "number" || typeof text !== "string") return null;
    out.push({ verse, text: text.replace(/\s+/g, " ").trim() });
  }
  return out;
}

async function fetchChapter(
  translation: string,
  book: string,
  chapter: number,
): Promise<Verse[]> {
  const reference = encodeURIComponent(`${book} ${chapter}`);
  const res = await fetch(
    `https://bible-api.com/${reference}?translation=${translation}`,
  );
  if (!res.ok) throw new Error(`bible-api responded ${res.status}`);
  const verses = parseChapterResponse(await res.json());
  if (verses === null) throw new Error("bible-api: unexpected response shape");
  return verses;
}

// Chapters read this session; flipping back to one is instant.
const cache = new Map<string, Verse[]>();

interface ChapterState {
  key: string;
  status: "loading" | "loaded" | "error";
  verses: Verse[];
}

export function useChapter(
  translation: string,
  book: string,
  chapter: number,
): { status: "loading" | "loaded" | "error"; verses: Verse[]; retry: () => void } {
  const key = `${translation}/${book}/${chapter}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ChapterState>({
    key,
    status: "loading",
    verses: [],
  });

  useEffect(() => {
    const cached = cache.get(key);
    if (cached !== undefined) {
      setState({ key, status: "loaded", verses: cached });
      return;
    }
    let cancelled = false;
    setState({ key, status: "loading", verses: [] });
    fetchChapter(translation, book, chapter).then(
      (verses) => {
        cache.set(key, verses);
        if (!cancelled) setState({ key, status: "loaded", verses });
      },
      () => {
        if (!cancelled) setState({ key, status: "error", verses: [] });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [translation, book, chapter, key, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  // Until the effect for a new key runs, report loading rather than the
  // previous chapter's content.
  if (state.key !== key) return { status: "loading", verses: [], retry };
  return { status: state.status, verses: state.verses, retry };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/bible/lib/use-chapter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/bible/lib/use-chapter.ts apps/web/src/components/bible/lib/use-chapter.test.ts
git commit -m "feat(web): chapter fetching from bible-api.com with session cache"
```

---

### Task 3: Reader-state persistence (`lib/reader-state.ts`)

**Files:**
- Create: `apps/web/src/components/bible/lib/reader-state.ts`
- Test: `apps/web/src/components/bible/lib/reader-state.test.ts`

**Interfaces:**
- Consumes: `getBook` from `./books` (Task 1).
- Produces (used by Task 4):
  - `const TRANSLATIONS: readonly { id: "web" | "kjv" | "asv"; label: string }[]`
  - `type TranslationId = "web" | "kjv" | "asv"`
  - `interface ReaderState { book: string; chapter: number; translation: TranslationId }`
  - `const DEFAULT_READER_STATE: ReaderState` — John 1, `web`
  - `const READER_STATE_KEY = "theologia.bible-reader"`
  - `parseReaderState(raw: string | null): ReaderState` — pure; falls back to the default on any invalid input

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/bible/lib/reader-state.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import {
  DEFAULT_READER_STATE,
  parseReaderState,
} from "./reader-state";

describe("parseReaderState", () => {
  test("missing state falls back to John 1 WEB", () => {
    expect(parseReaderState(null)).toEqual({
      book: "John",
      chapter: 1,
      translation: "web",
    });
  });

  test("round-trips a valid state", () => {
    const state = { book: "Romans", chapter: 8, translation: "kjv" };
    expect(parseReaderState(JSON.stringify(state))).toEqual(state);
  });

  test("corrupt JSON falls back to the default", () => {
    expect(parseReaderState("{not json")).toEqual(DEFAULT_READER_STATE);
  });

  test("unknown book falls back to the default", () => {
    expect(
      parseReaderState(
        JSON.stringify({ book: "Enoch", chapter: 1, translation: "web" }),
      ),
    ).toEqual(DEFAULT_READER_STATE);
  });

  test("out-of-range chapter falls back to the default", () => {
    expect(
      parseReaderState(
        JSON.stringify({ book: "Jude", chapter: 2, translation: "web" }),
      ),
    ).toEqual(DEFAULT_READER_STATE);
    expect(
      parseReaderState(
        JSON.stringify({ book: "John", chapter: 0, translation: "web" }),
      ),
    ).toEqual(DEFAULT_READER_STATE);
    expect(
      parseReaderState(
        JSON.stringify({ book: "John", chapter: 1.5, translation: "web" }),
      ),
    ).toEqual(DEFAULT_READER_STATE);
  });

  test("unknown translation falls back to the default", () => {
    expect(
      parseReaderState(
        JSON.stringify({ book: "John", chapter: 3, translation: "esv" }),
      ),
    ).toEqual(DEFAULT_READER_STATE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/bible/lib/reader-state.test.ts`
Expected: FAIL — cannot resolve `./reader-state`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/bible/lib/reader-state.ts`:

```ts
import { getBook } from "./books";

export const TRANSLATIONS = [
  { id: "web", label: "WEB" },
  { id: "kjv", label: "KJV" },
  { id: "asv", label: "ASV" },
] as const;

export type TranslationId = (typeof TRANSLATIONS)[number]["id"];

export interface ReaderState {
  book: string;
  chapter: number;
  translation: TranslationId;
}

export const DEFAULT_READER_STATE: ReaderState = {
  book: "John",
  chapter: 1,
  translation: "web",
};

export const READER_STATE_KEY = "theologia.bible-reader";

/** Reader state from localStorage; falls back to the default on any invalid input. */
export function parseReaderState(raw: string | null): ReaderState {
  if (raw === null) return DEFAULT_READER_STATE;
  try {
    const data = JSON.parse(raw) as {
      book?: unknown;
      chapter?: unknown;
      translation?: unknown;
    };
    const book = typeof data.book === "string" ? getBook(data.book) : null;
    const translation = TRANSLATIONS.find((t) => t.id === data.translation);
    if (
      book === null ||
      translation === undefined ||
      typeof data.chapter !== "number" ||
      !Number.isInteger(data.chapter) ||
      data.chapter < 1 ||
      data.chapter > book.chapters
    ) {
      return DEFAULT_READER_STATE;
    }
    return { book: book.name, chapter: data.chapter, translation: translation.id };
  } catch {
    return DEFAULT_READER_STATE;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/bible/lib/reader-state.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the whole web suite**

Run: `pnpm test`
Expected: PASS — all existing tests plus the three new bible test files.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/bible/lib/reader-state.ts apps/web/src/components/bible/lib/reader-state.test.ts
git commit -m "feat(web): persisted Bible reader position with safe fallback"
```

---

### Task 4: The panel component (`bible-panel.tsx`)

**Files:**
- Create: `apps/web/src/components/bible/bible-panel.tsx`
- Create: `apps/web/src/components/bible/bible-panel.module.css`

**Interfaces:**
- Consumes: `BOOKS`, `getBook`, `prevChapter`, `nextChapter` (Task 1); `useChapter` (Task 2); `TRANSLATIONS`, `DEFAULT_READER_STATE`, `READER_STATE_KEY`, `parseReaderState`, `ReaderState`, `TranslationId` (Task 3).
- Produces (used by Task 5): `default export BiblePanel({ onClose }: { onClose: () => void })` — renders an `<aside>`; expects to be a grid child of the chat shell on desktop; positions itself as a fixed overlay below 760px via its own CSS.

No unit test: this is a client component and vitest runs in the node environment without a DOM. Verification is `tsc --noEmit` here and manual verification in Task 5.

- [ ] **Step 1: Write the styles**

Create `apps/web/src/components/bible/bible-panel.module.css`:

```css
/* Inherits the chat palette custom properties from .root in
   chat-app.module.css (the panel renders inside that tree). */

.panel {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100svh;
  background: #120e08; /* a step above --ink-deep so it reads as its own surface */
  border-left: 1px solid var(--hairline);
}

/* ── Header ── */
.head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.85rem 0.9rem;
  border-bottom: 1px solid var(--hairline);
}

.select {
  min-width: 0;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--parchment);
  background: rgba(201, 162, 78, 0.06);
  border: 1px solid var(--hairline);
  border-radius: 2px;
  padding: 0.4rem 0.3rem;
  cursor: pointer;
}
.select:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 2px;
}
.select option {
  background: #120e08;
  color: var(--parchment);
}

.bookSelect {
  flex: 1;
}

.close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.8rem;
  height: 1.8rem;
  margin-left: 0.1rem;
  background: transparent;
  border: none;
  border-radius: 2px;
  color: var(--stone);
  cursor: pointer;
  transition: color 0.2s ease;
}
.close:hover {
  color: var(--gold-bright);
}
.close:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 2px;
}

/* ── Body ── */
.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.4rem 1.25rem 2rem;
  scrollbar-color: var(--hairline) transparent;
}

.reference {
  margin: 0 0 1rem;
  font-family: var(--font-fraunces), serif;
  font-optical-sizing: auto;
  font-style: italic;
  font-weight: 400;
  font-size: 1rem;
  color: var(--parchment);
}

.verse {
  margin: 0 0 0.55rem;
  font-family: var(--font-fraunces), serif;
  font-optical-sizing: auto;
  font-weight: 380;
  font-size: 0.98rem;
  line-height: 1.75;
  color: color-mix(in srgb, var(--parchment) 88%, var(--parchment-dim));
}

.verseNum {
  margin-right: 0.4rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.58rem;
  color: var(--gold);
}

/* ── Loading (pulsing lines, same idiom as .typing in chat-thread) ── */
.loading {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.loading span {
  height: 0.7rem;
  border-radius: 2px;
  background: rgba(201, 162, 78, 0.09);
}
.loading span:nth-child(2) {
  width: 92%;
}
.loading span:nth-child(3) {
  width: 80%;
}
.loading span:nth-child(4) {
  width: 88%;
}
@media (prefers-reduced-motion: no-preference) {
  .loading span {
    animation: pulse 1.3s ease-in-out infinite;
  }
  .loading span:nth-child(2) {
    animation-delay: 0.15s;
  }
  .loading span:nth-child(3) {
    animation-delay: 0.3s;
  }
  .loading span:nth-child(4) {
    animation-delay: 0.45s;
  }
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}

/* ── Error ── */
.error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.8rem;
  font-family: var(--font-inter), sans-serif;
  font-size: 0.88rem;
  color: var(--parchment-dim);
}
.error p {
  margin: 0;
}

.retry {
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--parchment-dim);
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: 2px;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
  transition:
    color 0.22s ease,
    border-color 0.22s ease;
}
.retry:hover {
  color: var(--gold);
  border-color: rgba(201, 162, 78, 0.55);
}
.retry:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 2px;
}

/* ── Footer ── */
.foot {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  padding: 0.7rem 0.9rem;
  border-top: 1px solid var(--hairline);
}

.nav {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--parchment-dim);
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: 2px;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
  transition:
    color 0.22s ease,
    border-color 0.22s ease;
}
.nav:hover:not(:disabled) {
  color: var(--gold);
  border-color: rgba(201, 162, 78, 0.55);
}
.nav:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 2px;
}
.nav:disabled {
  opacity: 0.35;
  cursor: default;
}

/* ── Mobile: full-screen overlay instead of a grid column ── */
@media (max-width: 760px) {
  .panel {
    position: fixed;
    inset: 0;
    z-index: 30;
    border-left: none;
  }
}
```

- [ ] **Step 2: Write the component**

Create `apps/web/src/components/bible/bible-panel.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
        <select
          className={`${styles.select} ${styles.bookSelect}`}
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
        <select
          className={styles.select}
          value={reader.chapter}
          aria-label="Chapter"
          onChange={(e) =>
            setReader((r) => ({ ...r, chapter: Number(e.target.value) }))
          }
        >
          {Array.from({ length: book.chapters }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
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
```

- [ ] **Step 3: Typecheck**

Run (from `apps/web/`): `pnpm exec tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/bible/bible-panel.tsx apps/web/src/components/bible/bible-panel.module.css
git commit -m "feat(web): Bible reader panel component"
```

---

### Task 5: Chat integration — toggle button and shell column

**Files:**
- Modify: `apps/web/src/components/chat/chat-app.tsx`
- Modify: `apps/web/src/components/chat/chat-app.module.css`
- Modify: `apps/web/src/components/chat/chat-thread.module.css:10-18` (header right padding)

**Interfaces:**
- Consumes: `BiblePanel` default export from `@/components/bible/bible-panel` (Task 4).
- Produces: user-facing feature; nothing downstream.

- [ ] **Step 1: Add the toggle and panel to `chat-app.tsx`**

Three edits. Add the imports:

```tsx
import { BookOpen } from "lucide-react";
import { useState } from "react";
```

(`useState` is already imported — only add `BookOpen` from lucide-react and the `BiblePanel` import below the existing component imports:)

```tsx
import BiblePanel from "@/components/bible/bible-panel";
```

Add state inside `ChatApp` next to `activeId`:

```tsx
const [bibleOpen, setBibleOpen] = useState(false);
```

Replace the returned JSX's shell/main wrapper so the shell gets a modifier class, the main gains the toggle button (before `ChatUsageMeter`), and the panel renders as the shell's third child:

```tsx
return (
  <div className={styles.root}>
    <div
      className={`${styles.shell}${bibleOpen ? ` ${styles.shellBible}` : ""}`}
    >
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNewChat={handleNewChat}
      />
      <main className={styles.main}>
        <div className={styles.fresco} aria-hidden />
        <div className={styles.overlay} aria-hidden />
        <div className={styles.grain} aria-hidden />
        {active === null ? <ChatUpgradeBanner /> : null}
        <div className={styles.content}>
          {active ? (
            <LiveThread key={active.id} conversation={active} />
          ) : (
            <ChatEmpty onStart={handleStart} />
          )}
        </div>
        <button
          type="button"
          className={`${styles.bibleToggle}${bibleOpen ? ` ${styles.bibleToggleActive}` : ""}`}
          aria-label={bibleOpen ? "Close Bible reader" : "Open Bible reader"}
          aria-pressed={bibleOpen}
          onClick={() => setBibleOpen((open) => !open)}
        >
          <BookOpen size={16} strokeWidth={2} />
        </button>
        <ChatUsageMeter />
      </main>
      {bibleOpen ? <BiblePanel onClose={() => setBibleOpen(false)} /> : null}
    </div>
  </div>
);
```

- [ ] **Step 2: Add the shell column and toggle styles to `chat-app.module.css`**

Append after the existing `.main` rule (keep the existing 760px media query at the bottom of the file and extend it as shown):

```css
/* Third column while the Bible reader is open */
.shellBible {
  grid-template-columns:
    clamp(240px, 22vw, 288px) minmax(0, 1fr)
    clamp(320px, 26vw, 400px);
}

.bibleToggle {
  position: absolute;
  top: 0.75rem;
  right: 0.9rem;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: transparent;
  border: 1px solid var(--hairline);
  border-radius: 2px;
  color: var(--parchment-dim);
  cursor: pointer;
  transition:
    color 0.22s ease,
    border-color 0.22s ease,
    background-color 0.22s ease;
}
.bibleToggle:hover {
  color: var(--gold);
  border-color: rgba(201, 162, 78, 0.55);
  background: rgba(201, 162, 78, 0.06);
}
.bibleToggle:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 2px;
}
.bibleToggleActive {
  color: var(--gold);
  border-color: rgba(201, 162, 78, 0.55);
}
```

And inside the existing `@media (max-width: 760px)` block, add:

```css
  .shellBible {
    grid-template-columns: 1fr;
  }
```

(The panel takes itself out of the grid below 760px via `position: fixed` in its own module, so the single column must not change.)

- [ ] **Step 3: Reserve header room for the toggle in `chat-thread.module.css`**

The floating toggle sits over the thread header's right edge where the context chip lives. Change the `.header` padding (line 16) from:

```css
  padding: 0.95rem clamp(1.25rem, 4vw, 2.4rem);
```

to:

```css
  padding: 0.95rem calc(0.9rem + 2rem + 0.75rem) 0.95rem
    clamp(1.25rem, 4vw, 2.4rem);
```

(right padding = toggle right offset + toggle width + gap.)

- [ ] **Step 4: Typecheck and run the suite**

Run (from `apps/web/`): `pnpm exec tsc --noEmit && pnpm test`
Expected: typecheck exits 0; all vitest suites PASS.

- [ ] **Step 5: Manual verification**

Start the dev server (from `apps/web/`): `pnpm dev` (port 3001; note the known Next 16.2.9 dev-mode memory leak — restart if it OOMs). Sign in, open `/chat`, and verify:

1. Book icon appears top-right in both the empty state and an open conversation, and doesn't collide with the header chip.
2. Clicking it opens the panel as a third column; John 1 (WEB) loads with superscript verse numbers.
3. Book/chapter/translation selects work; Prev is disabled at Genesis 1, Next at Revelation 22; Next from Malachi 4 lands on Matthew 1.
4. Close and reopen the panel — it restores the last position (check `localStorage["theologia.bible-reader"]`).
5. Chat remains fully usable (composer, scrolling) while the panel is open.
6. Narrow the window below 760px — the panel becomes a full-screen overlay and the close button returns to the chat.
7. DevTools → Network → block `bible-api.com`, switch chapters — the error message and working "Try again" button appear.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/chat/chat-app.tsx apps/web/src/components/chat/chat-app.module.css apps/web/src/components/chat/chat-thread.module.css
git commit -m "feat(web): book icon opens Bible reader panel beside the chat"
```
