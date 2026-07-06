import { describe, expect, test } from "vitest";

import { DEFAULT_READER_STATE, parseReaderState } from "./reader-state";

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
