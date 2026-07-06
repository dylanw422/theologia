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
): {
  status: "loading" | "loaded" | "error";
  verses: Verse[];
  retry: () => void;
} {
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
