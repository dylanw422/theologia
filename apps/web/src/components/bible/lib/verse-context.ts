import type { Verse } from "./use-chapter";

/** Conventional abbreviations for reference tokens; books absent here
 *  (John, Acts, Jude…) are already short enough to use as-is. */
const BOOK_ABBREVIATIONS: Record<string, string> = {
  Genesis: "Gen.",
  Exodus: "Ex.",
  Leviticus: "Lev.",
  Numbers: "Num.",
  Deuteronomy: "Deut.",
  Joshua: "Josh.",
  Judges: "Judg.",
  "1 Samuel": "1 Sam.",
  "2 Samuel": "2 Sam.",
  "1 Kings": "1 Kgs.",
  "2 Kings": "2 Kgs.",
  "1 Chronicles": "1 Chr.",
  "2 Chronicles": "2 Chr.",
  Nehemiah: "Neh.",
  Esther: "Esth.",
  Psalms: "Ps.",
  Proverbs: "Prov.",
  Ecclesiastes: "Eccl.",
  "Song of Solomon": "Song",
  Isaiah: "Isa.",
  Jeremiah: "Jer.",
  Lamentations: "Lam.",
  Ezekiel: "Ezek.",
  Daniel: "Dan.",
  Hosea: "Hos.",
  Obadiah: "Obad.",
  Micah: "Mic.",
  Nahum: "Nah.",
  Habakkuk: "Hab.",
  Zephaniah: "Zeph.",
  Haggai: "Hag.",
  Zechariah: "Zech.",
  Malachi: "Mal.",
  Matthew: "Matt.",
  Romans: "Rom.",
  "1 Corinthians": "1 Cor.",
  "2 Corinthians": "2 Cor.",
  Galatians: "Gal.",
  Ephesians: "Eph.",
  Philippians: "Phil.",
  Colossians: "Col.",
  "1 Thessalonians": "1 Thess.",
  "2 Thessalonians": "2 Thess.",
  "1 Timothy": "1 Tim.",
  "2 Timothy": "2 Tim.",
  Philemon: "Phlm.",
  Hebrews: "Heb.",
  James: "Jas.",
  "1 Peter": "1 Pet.",
  "2 Peter": "2 Pet.",
  Revelation: "Rev.",
};

/** "1-6", "1-3, 5" — sorted, contiguous runs collapsed. */
export function formatVerseRanges(verses: number[]): string {
  const sorted = [...verses].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (const n of sorted.slice(1)) {
    if (n === end + 1) {
      end = n;
      continue;
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    start = n;
    end = n;
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
}

/** The inline token typed into the composer, e.g. "[Matt. 6:1-6]". */
export function buildVerseToken(
  book: string,
  chapter: number,
  verses: number[],
): string {
  const abbrev = BOOK_ABBREVIATIONS[book] ?? book;
  return `[${abbrev} ${chapter}:${formatVerseRanges(verses)}]`;
}

/** The context block appended to the outgoing message for the model. */
export function buildVerseContext({
  book,
  chapter,
  verses,
  translation,
}: {
  book: string;
  chapter: number;
  verses: Verse[];
  translation: string;
}): string {
  const ranges = formatVerseRanges(verses.map((v) => v.verse));
  const lines = verses.map((v) => `${v.verse}. ${v.text}`).join("\n");
  return `<verses reference="${book} ${chapter}:${ranges}" translation="${translation}">\n${lines}\n</verses>`;
}

/** Remove appended verse blocks so the thread shows only what was typed. */
export function stripVerseContexts(text: string): string {
  return text.replace(/\s*<verses [^>]*>[\s\S]*?<\/verses>/g, "").trim();
}
