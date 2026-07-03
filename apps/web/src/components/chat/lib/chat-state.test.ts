import { describe, expect, it } from "vitest";

import { blocksToText, deriveTitle } from "./chat-state";

describe("deriveTitle", () => {
  it("uses the first line of the message, trimmed", () => {
    expect(deriveTitle("  Does baptism save?  ")).toBe("Does baptism save?");
    expect(deriveTitle("Romans 9\nsecond line")).toBe("Romans 9");
  });

  it("truncates long messages with an ellipsis", () => {
    const long = "a".repeat(80);
    const title = deriveTitle(long);
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back to a default for empty input", () => {
    expect(deriveTitle("   ")).toBe("New conversation");
  });
});

describe("blocksToText", () => {
  it("flattens blocks into readable text separated by blank lines", () => {
    const text = blocksToText([
      { type: "prose", text: "First paragraph." },
      { type: "scripture", reference: "Romans 6:4", text: "We were buried…" },
      { type: "history", heading: "Nicaea", text: "In 325 AD…" },
    ]);

    expect(text).toContain("First paragraph.");
    expect(text).toContain("Romans 6:4 — We were buried…");
    expect(text).toContain("Nicaea — In 325 AD…");
    expect(text.split("\n\n")).toHaveLength(3);
  });

  it("flattens structured blocks", () => {
    const text = blocksToText([
      {
        type: "points",
        kind: "objection",
        items: [{ title: "Corporate election", body: "Romans 9 concerns…" }],
      },
      {
        type: "resources",
        items: [
          {
            title: "The Christ of the Covenants",
            author: "O. Palmer Robertson",
            tier: "intermediate",
            note: "A classic.",
          },
        ],
      },
      {
        type: "lexicon",
        entries: [{ term: "βαπτίζω", translit: "baptizō", gloss: "to immerse" }],
      },
    ]);

    expect(text).toContain("Corporate election: Romans 9 concerns…");
    expect(text).toContain("The Christ of the Covenants (O. Palmer Robertson)");
    expect(text).toContain("βαπτίζω (baptizō): to immerse");
  });
});
