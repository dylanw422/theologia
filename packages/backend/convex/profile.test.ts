// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "./_generated/api";
import { latestPerTopic } from "./lib/profile";
import { scheduleExtraction, settingsForUser, upsertSettings } from "./profile";
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

describe("profile settings helpers", () => {
  test("upsertSettings creates then updates a single row", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      expect(await settingsForUser(ctx as never, "u1")).toBeNull();

      await upsertSettings(ctx as never, "u1", { optedIn: true });
      let settings = await settingsForUser(ctx as never, "u1");
      expect(settings).toMatchObject({ optedIn: true, paused: false });

      await upsertSettings(ctx as never, "u1", { paused: true });
      settings = await settingsForUser(ctx as never, "u1");
      expect(settings).toMatchObject({ optedIn: true, paused: true });

      const rows = await ctx.db.query("profileSettings").collect();
      expect(rows).toHaveLength(1);
    });
  });
});

describe("position selection", () => {
  test("getProfile-style read: latest per topic, excluded hidden", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const conversationId = await ctx.db.insert("conversations", {
        userId: "u1",
        threadId: "t1",
        mode: "qa",
        title: "Study",
      });
      const base = {
        userId: "u1",
        locus: "soteriology" as const,
        statement: "s",
        stance: "affirmed" as const,
        strength: "settled" as const,
        sourceConversationId: conversationId,
        excluded: false,
        userEdited: false,
      };
      await ctx.db.insert("positions", { ...base, topic: "election", statement: "old" });
      await ctx.db.insert("positions", { ...base, topic: "election", statement: "new" });
      await ctx.db.insert("positions", { ...base, topic: "atonement", excluded: true });

      const docs = await ctx.db
        .query("positions")
        .withIndex("by_user", (q) => q.eq("userId", "u1"))
        .collect();
      const visible = latestPerTopic(
        docs.map((d) => ({ ...d, createdAt: d._creationTime })),
      );
      expect(visible).toHaveLength(1);
      expect(visible[0].statement).toBe("new");
    });
  });
});

describe("scheduleExtraction", () => {
  async function seed(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      const conversationId = await ctx.db.insert("conversations", {
        userId: "u1",
        threadId: "t1",
        mode: "qa",
        title: "Study",
      });
      return conversationId;
    });
  }

  test("does nothing for free plan or when not opted in or paused", async () => {
    const t = convexTest(schema, modules);
    const conversationId = await seed(t);
    await t.run(async (ctx) => {
      // Never opted in.
      await scheduleExtraction(ctx as never, { conversationId, userId: "u1", planId: "scholar" });
      expect((await ctx.db.get(conversationId))?.pendingExtractionId).toBeUndefined();

      await upsertSettings(ctx as never, "u1", { optedIn: true });

      // Free plan.
      await scheduleExtraction(ctx as never, { conversationId, userId: "u1", planId: "free" });
      expect((await ctx.db.get(conversationId))?.pendingExtractionId).toBeUndefined();

      // Paused.
      await upsertSettings(ctx as never, "u1", { paused: true });
      await scheduleExtraction(ctx as never, { conversationId, userId: "u1", planId: "scholar" });
      expect((await ctx.db.get(conversationId))?.pendingExtractionId).toBeUndefined();
    });
  });

  test("schedules a job, and reschedules (cancelling the prior job) on the next message", async () => {
    const t = convexTest(schema, modules);
    const conversationId = await seed(t);
    await t.run(async (ctx) => {
      await upsertSettings(ctx as never, "u1", { optedIn: true });

      await scheduleExtraction(ctx as never, { conversationId, userId: "u1", planId: "scholar" });
      const first = (await ctx.db.get(conversationId))?.pendingExtractionId;
      expect(first).toBeDefined();

      await scheduleExtraction(ctx as never, { conversationId, userId: "u1", planId: "scholar" });
      const second = (await ctx.db.get(conversationId))?.pendingExtractionId;
      expect(second).toBeDefined();
      expect(second).not.toEqual(first);

      const firstJob = await ctx.db.system.get(first!);
      expect(firstJob?.state.kind).toBe("canceled");
      expect((await ctx.db.get(conversationId))?.lastMessageAt).toBeTypeOf("number");
    });
  });
});

describe("recordExtraction", () => {
  test("inserts claims, advances the high-water mark, clears the pending id", async () => {
    const t = convexTest(schema, modules);
    const conversationId = await t.run(async (ctx) =>
      ctx.db.insert("conversations", {
        userId: "u1",
        threadId: "t1",
        mode: "qa",
        title: "Study",
        framework: "reformed",
      }),
    );

    await t.mutation(internal.profile.recordExtraction, {
      conversationId,
      userId: "u1",
      lastExtractedOrder: 4,
      claims: [
        {
          locus: "soteriology",
          topic: "election",
          statement: "Regeneration precedes faith.",
          stance: "affirmed",
          strength: "leaning",
        },
      ],
    });

    await t.run(async (ctx) => {
      const positions = await ctx.db.query("positions").collect();
      expect(positions).toHaveLength(1);
      expect(positions[0]).toMatchObject({
        userId: "u1",
        locus: "soteriology",
        topic: "election",
        frameworkAtTime: "reformed",
        excluded: false,
        userEdited: false,
        sourceConversationId: conversationId,
      });
      const conversation = await ctx.db.get(conversationId);
      expect(conversation?.lastExtractedOrder).toBe(4);
      expect(conversation?.pendingExtractionId).toBeUndefined();
    });
  });
});
