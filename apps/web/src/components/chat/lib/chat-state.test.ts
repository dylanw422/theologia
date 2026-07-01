import { describe, expect, it } from "vitest";

import {
  appendMessage,
  blocksToText,
  createConversation,
  deriveTitle,
  type Block,
} from "./chat-state";

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

describe("createConversation", () => {
  it("seeds the conversation with the user's first message", () => {
    const convo = createConversation({
      mode: "qa",
      setup: { framework: "reformed", subTradition: "reformed-baptist" },
      firstMessage: "Does baptism save?",
    });

    expect(convo.mode).toBe("qa");
    expect(convo.framework).toBe("reformed");
    expect(convo.subTradition).toBe("reformed-baptist");
    expect(convo.title).toBe("Does baptism save?");
    expect(convo.messages).toHaveLength(1);
    expect(convo.messages[0]).toMatchObject({
      role: "user",
      content: "Does baptism save?",
    });
    expect(convo.messages[0].id).toBeTruthy();
  });

  it("carries mode-specific setup fields onto the conversation", () => {
    const convo = createConversation({
      mode: "comparison",
      setup: { traditions: ["reformed", "lutheran"] },
      firstMessage: "Faith and works",
    });
    expect(convo.mode).toBe("comparison");
    expect(convo.traditions).toEqual(["reformed", "lutheran"]);

    const catechism = createConversation({
      mode: "catechism",
      setup: { document: "heidelberg" },
      firstMessage: "Walk me through Question 1",
    });
    expect(catechism.document).toBe("heidelberg");
  });

  it("gives each conversation a unique id", () => {
    const a = createConversation({
      mode: "qa",
      setup: { framework: "lutheran" },
      firstMessage: "Hi",
    });
    const b = createConversation({
      mode: "qa",
      setup: { framework: "lutheran" },
      firstMessage: "Hi",
    });
    expect(a.id).not.toBe(b.id);
  });
});

describe("appendMessage", () => {
  const base = () =>
    createConversation({
      mode: "qa",
      setup: { framework: "baptist" },
      firstMessage: "Question one",
    });

  it("returns a new conversation with the message appended", () => {
    const convo = base();
    const next = appendMessage(convo, {
      role: "assistant",
      content: "An answer.",
    });

    expect(next).not.toBe(convo);
    expect(next.messages).toHaveLength(2);
    expect(next.messages[1]).toMatchObject({
      role: "assistant",
      content: "An answer.",
    });
    expect(next.messages[1].id).toBeTruthy();
  });

  it("preserves blocks and actions on the appended message", () => {
    const blocks: Block[] = [{ type: "prose", text: "A paragraph." }];
    const actions = [
      { id: "go", label: "Go deeper", prefill: "Go deeper.", next: "deep" },
    ];
    const next = appendMessage(base(), {
      role: "assistant",
      content: "A paragraph.",
      blocks,
      actions,
    });

    expect(next.messages[1].blocks).toEqual(blocks);
    expect(next.messages[1].actions).toEqual(actions);
  });

  it("does not mutate the original conversation", () => {
    const convo = base();
    appendMessage(convo, { role: "assistant", content: "An answer." });
    expect(convo.messages).toHaveLength(1);
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
