import { describe, expect, it } from "vitest";

import { createConversation } from "../chat-state";
import { FRAMEWORKS } from "../frameworks";
import { COMPARISON_ENTRIES, script as comparison } from "./comparison";

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
