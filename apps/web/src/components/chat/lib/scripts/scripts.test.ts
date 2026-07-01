import { describe, expect, it } from "vitest";

import { createConversation } from "../chat-state";
import { FRAMEWORKS } from "../frameworks";
import { DOCUMENTS } from "../modes";
import { CATECHISM_ARTICLES, script as catechism } from "./catechism";
import { COMPARISON_ENTRIES, script as comparison } from "./comparison";
import { script as resources } from "./resources";

describe("comparison content", () => {
  it("has a non-empty entry for every framework", () => {
    for (const framework of FRAMEWORKS) {
      const entry = COMPARISON_ENTRIES[framework.id];
      expect(entry, `missing entry for ${framework.id}`).toBeDefined();
      expect(entry.position.length).toBeGreaterThan(0);
      expect(entry.texts.length).toBeGreaterThan(0);
      expect(entry.theologians.length).toBeGreaterThan(0);
    }
  });

  it("builds one column per selected tradition, labeled with framework labels", () => {
    const convo = createConversation({
      mode: "comparison",
      setup: {
        traditions: ["reformed", "arminian-wesleyan", "roman-catholic"],
      },
      firstMessage: "Faith and works",
    });
    const entry = comparison.steps[comparison.entry];
    const blocks =
      typeof entry.blocks === "function" ? entry.blocks(convo) : entry.blocks;
    const table = blocks.find((b) => b.type === "comparison");

    expect(table).toBeDefined();
    if (table?.type !== "comparison") throw new Error("unreachable");
    expect(table.columns).toHaveLength(3);
    expect(table.columns.map((c) => c.tradition)).toEqual([
      "Reformed",
      "Arminian",
      "Roman Catholic",
    ]);
  });
});

describe("catechism content", () => {
  it("has a non-empty article for every GOAL.md document", () => {
    for (const doc of DOCUMENTS) {
      const article = CATECHISM_ARTICLES[doc.id];
      expect(article, `missing article for ${doc.id}`).toBeDefined();
      expect(article.label.length).toBeGreaterThan(0);
      expect(article.body.length).toBeGreaterThan(0);
      expect(article.explanation.length).toBeGreaterThan(0);
    }
  });

  it("serves the selected document's article, labeled with the document name", () => {
    const convo = createConversation({
      mode: "catechism",
      setup: { document: "heidelberg" },
      firstMessage: "Walk me through Question 1",
    });
    const entry = catechism.steps[catechism.entry];
    const blocks =
      typeof entry.blocks === "function" ? entry.blocks(convo) : entry.blocks;
    const article = blocks.find((b) => b.type === "article");

    expect(article).toBeDefined();
    if (article?.type !== "article") throw new Error("unreachable");
    expect(article.source).toBe("Heidelberg Catechism");
    expect(article.body.length).toBeGreaterThan(0);
  });
});

describe("resources content", () => {
  it("covers all three tiers in the entry reply", () => {
    const entry = resources.steps[resources.entry];
    const convo = createConversation({
      mode: "resources",
      setup: { framework: "reformed", purpose: "personal-study" },
      firstMessage: "Covenant theology",
    });
    const blocks =
      typeof entry.blocks === "function" ? entry.blocks(convo) : entry.blocks;
    const shelf = blocks.find((b) => b.type === "resources");

    expect(shelf).toBeDefined();
    if (shelf?.type !== "resources") throw new Error("unreachable");
    const tiers = new Set(shelf.items.map((i) => i.tier));
    expect(tiers).toEqual(
      new Set(["introductory", "intermediate", "scholarly"]),
    );
  });
});
