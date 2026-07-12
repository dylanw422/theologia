// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { latestPerTopic } from "./lib/profile";
import { allVisiblePositions, deleteTensionsReferencing, scheduleExtraction, settingsForUser, upsertSettings } from "./profile";
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

describe("deleteTensionsReferencing", () => {
  test("removes every tension touching the position, leaves the rest", async () => {
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
        stance: "affirmed" as const,
        strength: "settled" as const,
        sourceConversationId: conversationId,
        excluded: false,
        userEdited: false,
      };
      const pA = await ctx.db.insert("positions", { ...base, topic: "a", statement: "a" });
      const pB = await ctx.db.insert("positions", { ...base, topic: "b", statement: "b" });
      const pC = await ctx.db.insert("positions", { ...base, topic: "c", statement: "c" });
      const tension = { userId: "u1", description: "d", salience: 1, status: "open" as const };
      await ctx.db.insert("tensions", { ...tension, positionAId: pA, positionBId: pB });
      await ctx.db.insert("tensions", { ...tension, positionAId: pB, positionBId: pC });
      await ctx.db.insert("tensions", { ...tension, positionAId: pA, positionBId: pC });

      await deleteTensionsReferencing(ctx as never, "u1", pA);

      const remaining = await ctx.db.query("tensions").collect();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].positionAId).toBe(pB);
      expect(remaining[0].positionBId).toBe(pC);
    });
  });
});

describe("recordExtraction → tension detection", () => {
  test("schedules detectTensions when claims land, not on empty passes", async () => {
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
      lastExtractedOrder: 2,
      claims: [],
    });
    await t.run(async (ctx) => {
      const jobs = await ctx.db.system.query("_scheduled_functions").collect();
      expect(jobs.filter((j) => j.name.includes("detectTensions"))).toHaveLength(0);
    });

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
      const jobs = await ctx.db.system.query("_scheduled_functions").collect();
      const detection = jobs.filter((j) => j.name.includes("detectTensions"));
      expect(detection).toHaveLength(1);
      expect(detection[0].args[0]).toMatchObject({
        userId: "u1",
        claimLoci: ["soteriology"],
        framework: "reformed",
      });
    });
  });
});

describe("getPromptProfile", () => {
  const position = (conversationId: Id<"conversations">, excluded: boolean) => ({
    userId: "u1",
    locus: "soteriology" as const,
    topic: "election",
    statement: "Regeneration precedes faith.",
    stance: "affirmed" as const,
    strength: "settled" as const,
    sourceConversationId: conversationId,
    excluded,
    userEdited: false,
  });

  test("null before opt-in, and null when nothing is visible", async () => {
    const t = convexTest(schema, modules);
    expect(
      await t.query(internal.profile.getPromptProfile, { userId: "u1" }),
    ).toBeNull();

    await t.run(async (ctx) => {
      await upsertSettings(ctx as never, "u1", { optedIn: true });
      const conversationId = await ctx.db.insert("conversations", {
        userId: "u1",
        threadId: "t1",
        mode: "qa",
        title: "Study",
      });
      await ctx.db.insert("positions", position(conversationId, true));
    });
    // Opted in, but the only position is excluded.
    expect(
      await t.query(internal.profile.getPromptProfile, { userId: "u1" }),
    ).toBeNull();
  });

  test("returns the section when opted in — paused still injects", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await upsertSettings(ctx as never, "u1", { optedIn: true, paused: true });
      const conversationId = await ctx.db.insert("conversations", {
        userId: "u1",
        threadId: "t1",
        mode: "qa",
        title: "Study",
      });
      await ctx.db.insert("positions", position(conversationId, false));
    });
    const section = await t.query(internal.profile.getPromptProfile, {
      userId: "u1",
    });
    expect(section).toContain("## The user's theological profile");
    expect(section).toContain("Regeneration precedes faith.");
    // Someone else's profile never leaks.
    expect(
      await t.query(internal.profile.getPromptProfile, { userId: "u2" }),
    ).toBeNull();
  });
});

describe("allVisiblePositions", () => {
  test("drops excluded rows, keeps full per-topic history", async () => {
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
        topic: "election",
        stance: "affirmed" as const,
        strength: "settled" as const,
        sourceConversationId: conversationId,
        excluded: false,
        userEdited: false,
      };
      await ctx.db.insert("positions", { ...base, statement: "first" });
      await ctx.db.insert("positions", { ...base, statement: "second" });
      await ctx.db.insert("positions", {
        ...base,
        statement: "hidden",
        excluded: true,
      });

      const all = await allVisiblePositions(ctx as never, "u1");
      expect(all).toHaveLength(2);
      const history = [...all].sort((a, b) => a.createdAt - b.createdAt);
      expect(history.map((p) => p.statement)).toEqual(["first", "second"]);
    });
  });
});
