import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { latestPerTopic, vLocus } from "./lib/profile";
import {
  buildTensionSystemPrompt,
  buildTensionUserPrompt,
  lociToConsider,
  pairKey,
  parseTensionResponse,
  selectOpenTensions,
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

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

type PositionView = {
  id: Id<"positions">;
  statement: string;
  sourceConversationId: Id<"conversations">;
};

function toPositionView(doc: Doc<"positions">): PositionView {
  return {
    id: doc._id,
    statement: doc.statement,
    sourceConversationId: doc.sourceConversationId,
  };
}

async function fallbackFramework(
  ctx: QueryCtx,
  userId: string,
): Promise<string | undefined> {
  const recent = await ctx.db
    .query("conversations")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(25);
  return recent.find((c) => c.framework)?.framework;
}

/**
 * Tensions the profile may render: dismissed never; any tension whose
 * position is deleted or excluded is hidden (symmetry with the position
 * soft-exclude). Open is capped strongest-first; resolved is newest-first.
 */
export async function visibleTensionsForUser(ctx: QueryCtx, userId: string) {
  const docs = await ctx.db
    .query("tensions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  let fallback: string | undefined | null = null; // null = not yet computed
  const open = [];
  const resolved = [];
  for (const tension of docs) {
    if (tension.status === "dismissed") continue;
    const [a, b] = await Promise.all([
      ctx.db.get(tension.positionAId),
      ctx.db.get(tension.positionBId),
    ]);
    if (!a || !b || a.excluded || b.excluded) continue;

    const newerFirst = a._creationTime >= b._creationTime ? [a, b] : [b, a];
    let studyFramework =
      newerFirst[0].frameworkAtTime ?? newerFirst[1].frameworkAtTime;
    if (!studyFramework) {
      if (fallback === null) fallback = await fallbackFramework(ctx, userId);
      studyFramework = fallback;
    }

    const view = {
      id: tension._id,
      description: tension.description,
      historicalNote: tension.historicalNote,
      salience: tension.salience,
      status: tension.status,
      resolution: tension.resolution,
      decidedAt: tension.decidedAt,
      createdAt: tension._creationTime,
      studyFramework,
      positionA: toPositionView(a),
      positionB: toPositionView(b),
    };
    if (tension.status === "open") open.push(view);
    else resolved.push(view);
  }
  return {
    open: selectOpenTensions(open),
    resolved: resolved.sort((x, y) => (y.decidedAt ?? 0) - (x.decidedAt ?? 0)),
  };
}

async function isGated(ctx: QueryCtx, userId: string): Promise<boolean> {
  const planId = await getPlanIdForUser(ctx, userId);
  if (planId === "free") return true;
  const settings = await settingsForUser(ctx, userId);
  return !settings?.optedIn;
}

export const getTensions = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    if (await isGated(ctx, user._id)) return { open: [], resolved: [] };
    return await visibleTensionsForUser(ctx, user._id);
  },
});

export const openCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return 0;
    if (await isGated(ctx, user._id)) return 0;
    const docs = await ctx.db
      .query("tensions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "open"),
      )
      .collect();
    let count = 0;
    for (const tension of docs) {
      const [a, b] = await Promise.all([
        ctx.db.get(tension.positionAId),
        ctx.db.get(tension.positionBId),
      ]);
      if (a && b && !a.excluded && !b.excluded) count += 1;
    }
    return count;
  },
});

export async function decideTension(
  ctx: MutationCtx,
  userId: string,
  tensionId: Id<"tensions">,
  decision: { status: "resolved"; resolution: string } | { status: "dismissed" },
): Promise<void> {
  const tension = await ctx.db.get(tensionId);
  if (!tension || tension.userId !== userId) {
    throw new Error("Tension not found");
  }
  if (tension.status !== "open") throw new Error("Tension already decided");
  if (decision.status === "resolved") {
    const resolution = decision.resolution.trim();
    if (!resolution) throw new Error("Resolution is empty");
    await ctx.db.patch(tensionId, {
      status: "resolved",
      resolution,
      decidedAt: Date.now(),
    });
  } else {
    await ctx.db.patch(tensionId, {
      status: "dismissed",
      decidedAt: Date.now(),
    });
  }
}

export const resolveTension = mutation({
  args: { tensionId: v.id("tensions"), resolution: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await decideTension(ctx, user._id, args.tensionId, {
      status: "resolved",
      resolution: args.resolution,
    });
  },
});

export const dismissTension = mutation({
  args: { tensionId: v.id("tensions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await decideTension(ctx, user._id, args.tensionId, { status: "dismissed" });
  },
});

/**
 * Dismissal-rate monitor (spec: >25% means the judgment prompt isn't ready).
 * Ops-only, all users, run via: bunx convex run tensions:qualityStats
 * Full-table read — acceptable for an internal ops query at current scale.
 */
export const qualityStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("tensions").collect();
    const open = all.filter((t) => t.status === "open").length;
    const resolved = all.filter((t) => t.status === "resolved").length;
    const dismissed = all.filter((t) => t.status === "dismissed").length;
    const decided = resolved + dismissed;
    return {
      open,
      resolved,
      dismissed,
      dismissalRate: decided === 0 ? null : dismissed / decided,
    };
  },
});
