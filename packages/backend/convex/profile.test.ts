// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("profile schema", () => {
  test("positions and profileSettings rows insert and read back by index", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const conversationId = await ctx.db.insert("conversations", {
        userId: "user1",
        threadId: "thread1",
        mode: "qa",
        title: "Election",
      });
      await ctx.db.insert("positions", {
        userId: "user1",
        locus: "soteriology",
        topic: "election",
        statement: "Regeneration precedes faith.",
        stance: "affirmed",
        strength: "leaning",
        sourceConversationId: conversationId,
        frameworkAtTime: "reformed",
        excluded: false,
        userEdited: false,
      });
      await ctx.db.insert("profileSettings", {
        userId: "user1",
        optedIn: true,
        paused: false,
        decidedAt: Date.now(),
      });

      const positions = await ctx.db
        .query("positions")
        .withIndex("by_user_locus", (q) =>
          q.eq("userId", "user1").eq("locus", "soteriology"),
        )
        .collect();
      expect(positions).toHaveLength(1);
      expect(positions[0].statement).toBe("Regeneration precedes faith.");

      const settings = await ctx.db
        .query("profileSettings")
        .withIndex("by_user", (q) => q.eq("userId", "user1"))
        .unique();
      expect(settings?.optedIn).toBe(true);
    });
  });
});
