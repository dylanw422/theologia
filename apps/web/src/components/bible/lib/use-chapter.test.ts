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
