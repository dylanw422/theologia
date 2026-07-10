import { describe, expect, test } from "vitest";

import { findTokenRange } from "./token-ranges";

const TOKEN = "[Matt. 6:1-6]";

describe("findTokenRange", () => {
  test("caret inside the token finds its range", () => {
    const text = `What does ${TOKEN} mean?`;
    const start = text.indexOf(TOKEN);
    expect(findTokenRange(text, [TOKEN], start + 4)).toEqual({
      start,
      end: start + TOKEN.length,
    });
  });

  test("caret immediately before the token counts as inside", () => {
    const text = `Hey ${TOKEN}`;
    expect(findTokenRange(text, [TOKEN], 4)).toEqual({
      start: 4,
      end: 4 + TOKEN.length,
    });
  });

  test("caret immediately after the token counts as inside", () => {
    const text = `${TOKEN} means?`;
    expect(findTokenRange(text, [TOKEN], TOKEN.length)).toEqual({
      start: 0,
      end: TOKEN.length,
    });
  });

  test("caret elsewhere finds nothing", () => {
    const text = `Hey ${TOKEN} there`;
    expect(findTokenRange(text, [TOKEN], 2)).toBeNull();
    expect(findTokenRange(text, [TOKEN], text.length)).toBeNull();
  });

  test("matches the occurrence under the caret when a token repeats", () => {
    const text = `${TOKEN} and ${TOKEN}`;
    const second = text.lastIndexOf(TOKEN);
    expect(findTokenRange(text, [TOKEN], second + 2)).toEqual({
      start: second,
      end: second + TOKEN.length,
    });
  });

  test("distinguishes multiple different tokens", () => {
    const other = "[John 3:16]";
    const text = `${TOKEN} vs ${other}`;
    const otherStart = text.indexOf(other);
    expect(findTokenRange(text, [TOKEN, other], otherStart + 3)).toEqual({
      start: otherStart,
      end: otherStart + other.length,
    });
  });

  test("plain bracketed text the user typed is not a token", () => {
    expect(findTokenRange("[not a verse] hi", [TOKEN], 3)).toBeNull();
  });
});
