import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { latestPerTopic, vLocus } from "./lib/profile";
import {
  buildTensionSystemPrompt,
  buildTensionUserPrompt,
  lociToConsider,
  pairKey,
  parseTensionResponse,
  type IndexPair,
} from "./lib/tensions";
import { getPlanIdForUser } from "./polar";
import { settingsForUser } from "./profile";

export const getJudgmentContext = internalQuery({
  args: { userId: v.string(), claimLoci: v.array(vLocus) },
  handler: async (ctx, args) => {
    const settings = await settingsForUser(ctx, args.userId);
    const eligible = (settings?.optedIn ?? false) && !(settings?.paused ?? false);
    if (!eligible) {
      return { eligible: false, positions: [], coveredPairKeys: [] };
    }

    const loci = lociToConsider(args.claimLoci);
    const docs = [];
    for (const locus of loci) {
      const inLocus = await ctx.db
        .query("positions")
        .withIndex("by_user_locus", (q) =>
          q.eq("userId", args.userId).eq("locus", locus),
        )
        .collect();
      docs.push(...inLocus);
    }
    const latest = latestPerTopic(
      docs.map((d) => ({ ...d, createdAt: d._creationTime })),
    );
    const positions = latest.map((d) => ({
      id: d._id,
      statement: d.statement,
      locus: d.locus,
      stance: d.stance,
      topic: d.topic,
    }));

    const existing = await ctx.db
      .query("tensions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const coveredPairKeys = existing.map((t) =>
      pairKey(t.positionAId, t.positionBId),
    );

    return { eligible: true, positions, coveredPairKeys };
  },
});

const vTensionClaim = v.object({
  positionAId: v.id("positions"),
  positionBId: v.id("positions"),
  description: v.string(),
  historicalNote: v.optional(v.string()),
  salience: v.number(),
});

export const recordTensions = internalMutation({
  args: { userId: v.string(), tensions: v.array(vTensionClaim) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tensions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const covered = new Set(
      existing.map((t) => pairKey(t.positionAId, t.positionBId)),
    );
    for (const tension of args.tensions) {
      if (tension.positionAId === tension.positionBId) continue;
      const key = pairKey(tension.positionAId, tension.positionBId);
      if (covered.has(key)) continue;
      const [a, b] = await Promise.all([
        ctx.db.get(tension.positionAId),
        ctx.db.get(tension.positionBId),
      ]);
      if (!a || !b || a.userId !== args.userId || b.userId !== args.userId) {
        continue;
      }
      await ctx.db.insert("tensions", {
        userId: args.userId,
        positionAId: tension.positionAId,
        positionBId: tension.positionBId,
        description: tension.description,
        historicalNote: tension.historicalNote,
        salience: tension.salience,
        status: "open",
      });
      covered.add(key);
    }
  },
});

/**
 * The judgment pass (docs/THEOLOGICAL_PROFILE.md §3). One Sonnet call over
 * the user's positions in the affected + adjacent loci; any failure detects
 * nothing (fail closed) — there is no bookkeeping to unwind.
 */
export const detectTensions = internalAction({
  args: {
    userId: v.string(),
    claimLoci: v.array(vLocus),
    framework: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const context = await ctx.runQuery(internal.tensions.getJudgmentContext, {
        userId: args.userId,
        claimLoci: args.claimLoci,
      });
      if (!context.eligible || context.positions.length < 2) return;

      const planId = await getPlanIdForUser(ctx, args.userId);
      if (planId === "free") return;

      const idToIndex = new Map(context.positions.map((p, i) => [p.id, i]));
      const coveredIndexPairs: IndexPair[] = [];
      for (const key of context.coveredPairKeys) {
        const [idA, idB] = key.split("|") as [Id<"positions">, Id<"positions">];
        const a = idToIndex.get(idA);
        const b = idToIndex.get(idB);
        if (a !== undefined && b !== undefined) {
          coveredIndexPairs.push(a < b ? [a, b] : [b, a]);
        }
      }

      const result = await generateText({
        model: anthropic("claude-sonnet-5"),
        system: buildTensionSystemPrompt(),
        prompt: buildTensionUserPrompt(
          context.positions,
          coveredIndexPairs,
          args.framework,
        ),
        maxOutputTokens: 1500,
      });
      const parsed = parseTensionResponse(
        result.text,
        context.positions.length,
        coveredIndexPairs,
      );
      if (parsed.length === 0) return;

      await ctx.runMutation(internal.tensions.recordTensions, {
        userId: args.userId,
        tensions: parsed.map((item) => ({
          positionAId: context.positions[item.a].id,
          positionBId: context.positions[item.b].id,
          description: item.description,
          historicalNote: item.historicalNote,
          salience: item.salience,
        })),
      });
    } catch (error) {
      console.error("detectTensions failed", error);
    }
  },
});
