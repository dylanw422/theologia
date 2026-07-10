import { describe, expect, test } from "vitest";

import {
  buildVerseContext,
  buildVerseToken,
  formatVerseRanges,
  stripVerseContexts,
} from "./verse-context";

describe("formatVerseRanges", () => {
  test("single verse", () => {
    expect(formatVerseRanges([3])).toBe("3");
  });

  test("contiguous run collapses to a range", () => {
    expect(formatVerseRanges([1, 2, 3, 4, 5, 6])).toBe("1-6");
  });

  test("non-contiguous selection becomes comma-separated ranges", () => {
    expect(formatVerseRanges([1, 2, 3, 5])).toBe("1-3, 5");
  });

  test("unsorted input is sorted first", () => {
    expect(formatVerseRanges([5, 1, 3, 2])).toBe("1-3, 5");
  });
});

describe("buildVerseToken", () => {
  test("abbreviates the book name", () => {
    expect(buildVerseToken("Matthew", 6, [1, 2, 3, 4, 5, 6])).toBe(
      "[Matt. 6:1-6]",
    );
  });

  test("keeps short book names unabbreviated", () => {
    expect(buildVerseToken("John", 3, [16])).toBe("[John 3:16]");
  });

  test("handles numbered books", () => {
    expect(buildVerseToken("1 Corinthians", 13, [4, 5, 6, 7])).toBe(
      "[1 Cor. 13:4-7]",
    );
  });
});

describe("buildVerseContext", () => {
  test("wraps verses in a tagged block with full reference and translation", () => {
    expect(
      buildVerseContext({
        book: "Matthew",
        chapter: 6,
        verses: [
          { verse: 1, text: "Be careful not to practice…" },
          { verse: 2, text: "So when you give…" },
        ],
        translation: "WEB",
      }),
    ).toBe(
      '<verses reference="Matthew 6:1-2" translation="WEB">\n' +
        "1. Be careful not to practice…\n" +
        "2. So when you give…\n" +
        "</verses>",
    );
  });
});

describe("stripVerseContexts", () => {
  test("removes appended verse blocks, keeping the typed message", () => {
    const context = buildVerseContext({
      book: "Matthew",
      chapter: 6,
      verses: [{ verse: 1, text: "Be careful…" }],
      translation: "WEB",
    });
    const outgoing = `What does [Matt. 6:1] teach about giving?\n\n${context}`;
    expect(stripVerseContexts(outgoing)).toBe(
      "What does [Matt. 6:1] teach about giving?",
    );
  });

  test("removes multiple blocks", () => {
    const a = buildVerseContext({
      book: "Matthew",
      chapter: 6,
      verses: [{ verse: 1, text: "a" }],
      translation: "WEB",
    });
    const b = buildVerseContext({
      book: "John",
      chapter: 3,
      verses: [{ verse: 16, text: "b" }],
      translation: "KJV",
    });
    expect(stripVerseContexts(`Compare these.\n\n${a}\n\n${b}`)).toBe(
      "Compare these.",
    );
  });

  test("leaves plain messages untouched", () => {
    expect(stripVerseContexts("Just a question")).toBe("Just a question");
  });
});
