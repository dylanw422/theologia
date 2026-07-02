import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "./prompts";

describe("buildSystemPrompt", () => {
  it("every mode includes the persona, tag spec, and followups guidance", () => {
    const modes = [
      "qa",
      "devils-advocate",
      "comparison",
      "debate-prep",
      "catechism",
      "resources",
      "library",
      "scripture-study",
    ] as const;
    for (const mode of modes) {
      const prompt = buildSystemPrompt(mode, {
        framework: "reformed",
        opposing: "arminian-wesleyan",
        traditions: ["reformed", "lutheran"],
        document: "westminster",
        purpose: "sermon-prep",
        collection: "ante-nicene",
      });
      expect(prompt).toContain("Theologia");
      expect(prompt).toContain("<scripture");
      expect(prompt).toContain("<followups>");
      expect(prompt).toContain("only when");
    }
  });

  it("qa speaks from within the tradition, with sub-tradition refinement", () => {
    const prompt = buildSystemPrompt("qa", {
      framework: "reformed",
      subTradition: "presbyterian",
    });
    expect(prompt).toContain("Reformed");
    expect(prompt).toContain("Presbyterian");
  });

  it("devils-advocate names both traditions and demands objection points", () => {
    const prompt = buildSystemPrompt("devils-advocate", {
      framework: "reformed",
      opposing: "arminian-wesleyan",
    });
    expect(prompt).toContain("Reformed");
    expect(prompt).toContain("Arminian");
    expect(prompt).toContain('kind="objection"');
    expect(prompt).toContain("strawman");
  });

  it("comparison lists every selected tradition", () => {
    const prompt = buildSystemPrompt("comparison", {
      traditions: ["reformed", "lutheran", "roman-catholic"],
    });
    expect(prompt).toContain("Reformed");
    expect(prompt).toContain("Lutheran");
    expect(prompt).toContain("Roman Catholic");
    expect(prompt).toContain("<comparison>");
  });

  it("catechism names the document and article tag", () => {
    const prompt = buildSystemPrompt("catechism", { document: "westminster" });
    expect(prompt).toContain("Westminster Standards");
    expect(prompt).toContain("<article");
  });

  it("resources names tradition, purpose, and the resources tag", () => {
    const prompt = buildSystemPrompt("resources", {
      framework: "baptist",
      purpose: "sermon-prep",
    });
    expect(prompt).toContain("Baptist");
    expect(prompt).toContain("Sermon prep");
    expect(prompt).toContain("<resources>");
  });

  it("library names the collection and source tag", () => {
    const prompt = buildSystemPrompt("library", { collection: "ante-nicene" });
    expect(prompt).toContain("Ante-Nicene Fathers");
    expect(prompt).toContain("<source");
  });

  it("library works with no collection selected (all collections)", () => {
    const prompt = buildSystemPrompt("library", {});
    expect(prompt).toContain("<source");
  });

  it("scripture-study includes lexicon and history tags", () => {
    const prompt = buildSystemPrompt("scripture-study", {
      framework: "lutheran",
    });
    expect(prompt).toContain("Lutheran");
    expect(prompt).toContain("<lexicon>");
    expect(prompt).toContain("<history");
  });

  it("unknown labels degrade gracefully", () => {
    const prompt = buildSystemPrompt("qa", { framework: "not-a-real-id" });
    expect(prompt).toContain("Theologia");
    expect(prompt).not.toContain("undefined");
  });
});
