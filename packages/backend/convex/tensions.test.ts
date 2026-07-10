// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "./_generated/api";
import { upsertSettings } from "./profile";
import { decideTension, visibleTensionsForUser } from "./tensions";
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

  test("dedupes duplicate pairs within a single call", async () => {
    const t = convexTest(schema, modules);
    const { positionAId, positionBId } = await seedPositions(t);
    const claim = {
      positionAId,
      positionBId,
      description: "d",
      salience: 1,
    };

    await t.mutation(internal.tensions.recordTensions, {
      userId: "u1",
      tensions: [
        claim,
        { ...claim, positionAId: positionBId, positionBId: positionAId },
      ],
    });

    await t.run(async (ctx) => {
      const rows = await ctx.db.query("tensions").collect();
      expect(rows).toHaveLength(1);
    });
  });
});

describe("decideTension", () => {
  test("resolves with text, dismisses without, rejects re-deciding and foreign users", async () => {
    const t = convexTest(schema, modules);
    const { positionAId, positionBId } = await seedPositions(t);
    const tensionId = await t.run(async (ctx) =>
      ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId,
        description: "d",
        salience: 2,
        status: "open",
      }),
    );

    await t.run(async (ctx) => {
      await expect(
        decideTension(ctx as never, "intruder", tensionId, {
          status: "dismissed",
        }),
      ).rejects.toThrow("Tension not found");

      await expect(
        decideTension(ctx as never, "u1", tensionId, {
          status: "resolved",
          resolution: "   ",
        }),
      ).rejects.toThrow("Resolution is empty");

      await decideTension(ctx as never, "u1", tensionId, {
        status: "resolved",
        resolution: "Dort distinguishes ground from evidence; I hold both.",
      });
      const row = await ctx.db.get(tensionId);
      expect(row?.status).toBe("resolved");
      expect(row?.resolution).toContain("Dort");
      expect(row?.decidedAt).toBeTypeOf("number");

      await expect(
        decideTension(ctx as never, "u1", tensionId, { status: "dismissed" }),
      ).rejects.toThrow("already decided");
    });
  });
});

describe("visibleTensionsForUser", () => {
  test("hides dismissed tensions and tensions with excluded or deleted positions; resolves studyFramework", async () => {
    const t = convexTest(schema, modules);
    const { conversationId, positionAId, positionBId } = await seedPositions(t);

    await t.run(async (ctx) => {
      const base = {
        userId: "u1",
        stance: "affirmed" as const,
        strength: "settled" as const,
        sourceConversationId: conversationId,
        excluded: false,
        userEdited: false,
      };
      const positionCId = await ctx.db.insert("positions", {
        ...base,
        locus: "soteriology",
        topic: "assurance",
        statement: "Assurance is of the essence of faith.",
        excluded: true, // hides any tension touching it
      });
      const positionDId = await ctx.db.insert("positions", {
        ...base,
        locus: "eschatology",
        topic: "millennium",
        statement: "The millennium is the present reign of Christ.",
        // no frameworkAtTime → studyFramework falls back to the conversation's
      });

      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId,
        description: "visible open",
        salience: 3,
        status: "open",
      });
      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId: positionCId,
        description: "hidden — excluded position",
        salience: 2,
        status: "open",
      });
      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId: positionBId,
        positionBId: positionDId,
        description: "resolved one",
        salience: 1,
        status: "resolved",
        resolution: "Held together in hope.",
        decidedAt: Date.now(),
      });
      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId,
        positionBId: positionDId,
        description: "dismissed — never renders",
        salience: 3,
        status: "dismissed",
        decidedAt: Date.now(),
      });

      const { open, resolved } = await visibleTensionsForUser(
        ctx as never,
        "u1",
      );
      expect(open).toHaveLength(1);
      expect(open[0].description).toBe("visible open");
      expect(open[0].positionA.statement).toBe("Regeneration precedes faith.");
      // Both open-tension positions carry frameworkAtTime — the newer-position branch.
      expect(open[0].studyFramework).toBe("reformed");
      expect(resolved).toHaveLength(1);
      expect(resolved[0].resolution).toBe("Held together in hope.");
      // D (newer) has no frameworkAtTime, so the older position B's applies.
      expect(resolved[0].studyFramework).toBe("reformed");
    });
  });

  test("falls back to the most recent conversation's framework when neither position has one", async () => {
    const t = convexTest(schema, modules);
    const { conversationId } = await seedPositions(t);

    await t.run(async (ctx) => {
      const base = {
        userId: "u1",
        stance: "affirmed" as const,
        strength: "settled" as const,
        sourceConversationId: conversationId,
        excluded: false,
        userEdited: false,
      };
      const bareA = await ctx.db.insert("positions", {
        ...base,
        locus: "eschatology",
        topic: "millennium",
        statement: "The millennium is the present reign of Christ.",
      });
      const bareB = await ctx.db.insert("positions", {
        ...base,
        locus: "eschatology",
        topic: "second-coming",
        statement: "Christ will return bodily.",
      });
      await ctx.db.insert("tensions", {
        userId: "u1",
        positionAId: bareA,
        positionBId: bareB,
        description: "d",
        salience: 1,
        status: "open",
      });

      const { open } = await visibleTensionsForUser(ctx as never, "u1");
      expect(open).toHaveLength(1);
      // Neither position carries frameworkAtTime; the seeded conversation
      // (framework: "reformed") supplies the fallback.
      expect(open[0].studyFramework).toBe("reformed");
    });
  });
});

describe("qualityStats", () => {
  test("counts by status and computes the dismissal rate over decided tensions", async () => {
    const t = convexTest(schema, modules);
    const { positionAId, positionBId } = await seedPositions(t);

    let stats = await t.query(internal.tensions.qualityStats, {});
    expect(stats).toEqual({
      open: 0,
      resolved: 0,
      dismissed: 0,
      dismissalRate: null,
    });

    await t.run(async (ctx) => {
      const base = {
        userId: "u1",
        positionAId,
        positionBId,
        description: "d",
        salience: 1,
      };
      await ctx.db.insert("tensions", { ...base, status: "open" });
      await ctx.db.insert("tensions", { ...base, status: "resolved" });
      await ctx.db.insert("tensions", { ...base, status: "resolved" });
      await ctx.db.insert("tensions", { ...base, status: "dismissed" });
    });

    stats = await t.query(internal.tensions.qualityStats, {});
    expect(stats.open).toBe(1);
    expect(stats.resolved).toBe(2);
    expect(stats.dismissed).toBe(1);
    expect(stats.dismissalRate).toBeCloseTo(1 / 3);
  });
});
