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
