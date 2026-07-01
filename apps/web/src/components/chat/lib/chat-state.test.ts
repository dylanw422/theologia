import { describe, expect, it } from "vitest";

import {
  appendMessage,
  blocksToText,
  createConversation,
  deriveTitle,
  replyFor,
  withReply,
  type Block,
} from "./chat-state";
import type { Script } from "./scripts/types";

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

describe("script engine", () => {
  const script: Script = {
    entry: "opening",
    steps: {
      opening: {
        blocks: [{ type: "prose", text: "Opening answer." }],
        actions: [
          { id: "b", label: "Go to B", prefill: "Take me to B.", next: "b" },
        ],
      },
      b: {
        blocks: (c) => [{ type: "prose", text: `B for ${c.framework}.` }],
        onReply: "c",
      },
      c: { blocks: [{ type: "prose", text: "C evaluates your reply." }] },
    },
    fallback: [{ type: "prose", text: "Fallback." }],
  };

  const convo = () =>
    createConversation({
      mode: "qa",
      setup: { framework: "reformed" },
      firstMessage: "Start",
    });

  it("serves the entry step for the first message", () => {
    const reply = replyFor(convo(), script, { isFirst: true });
    expect(reply.blocks).toEqual([{ type: "prose", text: "Opening answer." }]);
    expect(reply.actions?.[0]?.next).toBe("b");
    expect(reply.nextTypedStep).toBeUndefined();
  });

  it("routes action clicks to the named step and resolves function blocks", () => {
    const reply = replyFor(convo(), script, { actionNext: "b" });
    expect(reply.blocks).toEqual([{ type: "prose", text: "B for reformed." }]);
    expect(reply.nextTypedStep).toBe("c");
  });

  it("consumes nextTypedStep for typed messages, then clears it", () => {
    let c = withReply(convo(), script, { actionNext: "b" });
    expect(c.nextTypedStep).toBe("c");

    c = withReply(c, script);
    const last = c.messages[c.messages.length - 1];
    expect(last.blocks).toEqual([
      { type: "prose", text: "C evaluates your reply." },
    ]);
    expect(c.nextTypedStep).toBeUndefined();
  });

  it("falls back for typed messages with nothing pending", () => {
    const reply = replyFor(convo(), script);
    expect(reply.blocks).toEqual([{ type: "prose", text: "Fallback." }]);
    expect(reply.actions).toBeUndefined();
  });

  it("withReply appends an assistant message with flattened content", () => {
    const c = withReply(convo(), script, { isFirst: true });
    const last = c.messages[c.messages.length - 1];
    expect(last.role).toBe("assistant");
    expect(last.content).toBe("Opening answer.");
    expect(last.actions?.[0]?.label).toBe("Go to B");
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
