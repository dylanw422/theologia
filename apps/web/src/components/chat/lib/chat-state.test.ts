import { describe, expect, it } from "vitest";

import { appendMessage, createConversation, deriveTitle } from "./chat-state";

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
      framework: "reformed",
      subTradition: "reformed-baptist",
      firstMessage: "Does baptism save?",
    });

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

  it("gives each conversation a unique id", () => {
    const a = createConversation({ framework: "lutheran", firstMessage: "Hi" });
    const b = createConversation({ framework: "lutheran", firstMessage: "Hi" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("appendMessage", () => {
  it("returns a new conversation with the message appended", () => {
    const convo = createConversation({
      framework: "baptist",
      firstMessage: "Question one",
    });

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

  it("does not mutate the original conversation", () => {
    const convo = createConversation({
      framework: "baptist",
      firstMessage: "Question one",
    });

    appendMessage(convo, { role: "assistant", content: "An answer." });

    expect(convo.messages).toHaveLength(1);
  });
});
