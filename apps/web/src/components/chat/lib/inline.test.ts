import { describe, expect, it } from "vitest";

import { tokenizeEmphasis } from "./inline";

describe("tokenizeEmphasis", () => {
  it("wraps *single* asterisks as italic", () => {
    expect(tokenizeEmphasis("chosen *en Christō*, in Christ")).toEqual([
      { type: "text", text: "chosen " },
      { type: "em", text: "en Christō" },
      { type: "text", text: ", in Christ" },
    ]);
  });

  it("wraps **double** asterisks as bold", () => {
    expect(tokenizeEmphasis("**Redemption, Revelation: 1:7–14** we")).toEqual([
      { type: "strong", text: "Redemption, Revelation: 1:7–14" },
      { type: "text", text: " we" },
    ]);
  });

  it("handles bold and italic in the same run", () => {
    expect(tokenizeEmphasis("**bold** then *italic* end")).toEqual([
      { type: "strong", text: "bold" },
      { type: "text", text: " then " },
      { type: "em", text: "italic" },
      { type: "text", text: " end" },
    ]);
  });

  it("leaves plain text untouched", () => {
    expect(tokenizeEmphasis("no emphasis here")).toEqual([
      { type: "text", text: "no emphasis here" },
    ]);
  });

  it("leaves a lone asterisk alone", () => {
    expect(tokenizeEmphasis("2 * 2 = 4")).toEqual([
      { type: "text", text: "2 * 2 = 4" },
    ]);
  });
});
