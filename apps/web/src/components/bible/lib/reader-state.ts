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
    return {
      book: book.name,
      chapter: data.chapter,
      translation: translation.id,
    };
  } catch {
    return DEFAULT_READER_STATE;
  }
}
