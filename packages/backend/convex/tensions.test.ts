// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedPositions(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const conversationId = await ctx.db.insert("conversations", {
      userId: "u1",
      threadId: "t1",
      mode: "qa",
      title: "Study",
      framework: "reformed",
    });
    const base = {
      userId: "u1",
      stance: "affirmed" as const,
      strength: "settled" as const,
      sourceConversationId: conversationId,
      frameworkAtTime: "reformed",
      excluded: false,
      userEdited: false,
    };
    const positionAId = await ctx.db.insert("positions", {
      ...base,
      locus: "soteriology",
      topic: "election",
      statement: "Regeneration precedes faith.",
    });
    const positionBId = await ctx.db.insert("positions", {
      ...base,
      locus: "soteriology",
      topic: "grace",
      statement: "Grace is resistible.",
    });
    return { conversationId, positionAId, positionBId };
  });
}

describe("tensions schema", () => {
  test("rows insert and read back by status index", async () => {
    const t = convexTest(schema, modules);
    const { positionAId, positionBId } = await seedPositions(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId,
        description: "Assurance grounded two different ways.",
        historicalNote: "Dort distinguished ground from evidence.",
        salience: 2,
        status: "open",
      });

      const open = await ctx.db
        .query("tensions")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", "u1").eq("status", "open"),
        )
        .collect();
      expect(open).toHaveLength(1);
      expect(open[0].salience).toBe(2);
      expect(open[0].resolution).toBeUndefined();
    });
  });
});
