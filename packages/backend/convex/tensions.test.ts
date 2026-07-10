// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "./_generated/api";
import { upsertSettings } from "./profile";
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

describe("getJudgmentContext", () => {
  test("gates on settings; returns latest non-excluded positions in adjacent loci + covered pairs", async () => {
    const t = convexTest(schema, modules);
    const { conversationId, positionAId, positionBId } = await seedPositions(t);

    // Not opted in yet → ineligible.
    let context = await t.query(internal.tensions.getJudgmentContext, {
      userId: "u1",
      claimLoci: ["soteriology"],
    });
    expect(context.eligible).toBe(false);
    expect(context.positions).toEqual([]);

    await t.run(async (ctx) => {
      await upsertSettings(ctx as never, "u1", { optedIn: true });
      const base = {
        userId: "u1",
        stance: "affirmed" as const,
        strength: "settled" as const,
        sourceConversationId: conversationId,
        excluded: false,
        userEdited: false,
      };
      // Adjacent locus (anthropology-sin borders soteriology) — included.
      await ctx.db.insert("positions", {
        ...base,
        locus: "anthropology-sin",
        topic: "total-depravity",
        statement: "The fall corrupts every human faculty.",
      });
      // Non-adjacent locus — excluded from consideration.
      await ctx.db.insert("positions", {
        ...base,
        locus: "scripture-revelation",
        topic: "inerrancy",
        statement: "Scripture is without error.",
      });
      // Excluded position — hidden.
      await ctx.db.insert("positions", {
        ...base,
        locus: "soteriology",
        topic: "assurance",
        statement: "Assurance is of the essence of faith.",
        excluded: true,
      });
      // Existing tension → covered pair.
      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId,
        description: "d",
        salience: 1,
        status: "dismissed",
      });
    });

    context = await t.query(internal.tensions.getJudgmentContext, {
      userId: "u1",
      claimLoci: ["soteriology"],
    });
    expect(context.eligible).toBe(true);
    const topics = context.positions.map((p) => p.topic).sort();
    expect(topics).toEqual(["election", "grace", "total-depravity"]);
    expect(context.coveredPairKeys).toHaveLength(1);
  });
});

describe("recordTensions", () => {
  test("inserts open tensions once per pair, skipping covered and foreign pairs", async () => {
    const t = convexTest(schema, modules);
    const { positionAId, positionBId } = await seedPositions(t);
    const claim = {
      positionAId,
      positionBId,
      description: "Assurance grounded two different ways.",
      salience: 2,
    };

    await t.mutation(internal.tensions.recordTensions, {
      userId: "u1",
      tensions: [claim],
    });
    // Same pair again (either order) → no duplicate.
    await t.mutation(internal.tensions.recordTensions, {
      userId: "u1",
      tensions: [
        { ...claim, positionAId: positionBId, positionBId: positionAId },
      ],
    });
    // Another user's ids → skipped (positions belong to u1).
    await t.mutation(internal.tensions.recordTensions, {
      userId: "u2",
      tensions: [claim],
    });

    await t.run(async (ctx) => {
      const rows = await ctx.db.query("tensions").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ userId: "u1", status: "open", salience: 2 });
    });
  });
});
