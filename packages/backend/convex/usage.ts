// Usage metering: recording (via the agent usageHandler), enforcement
// (called from chat mutations), and the meter query.
//
// NOTE: this module must not statically import ./polar — convex-test loads
// modules lazily per invoked function, and recordUsage tests must not pull
// in component-backed modules. Plan lookup goes through api/internal refs.

import type { UsageHandler } from "@convex-dev/agent";
import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import {
  internalMutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import {
  FREE_MONTHLY_QUERY_LIMIT,
  PLANS,
  type PlanId,
} from "./lib/plans";
import {
  costMicroUsd,
  monthStartUtc,
  nextMonthlyResetUtc,
  nextWeeklyResetUtc,
  weekStartUtc,
} from "./lib/usageMath";

export const recordUsage = internalMutation({
  args: {
    userId: v.string(),
    model: v.string(),
    uncachedInputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheWriteTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const weekStart = weekStartUtc(Date.now());
    const micro = costMicroUsd(args.model, args);
    const existing = await ctx.db
      .query("usageWeeks")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", args.userId).eq("weekStart", weekStart),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        microUsd: existing.microUsd + micro,
        inputTokens: existing.inputTokens + args.uncachedInputTokens,
        outputTokens: existing.outputTokens + args.outputTokens,
        cacheReadTokens: existing.cacheReadTokens + args.cacheReadTokens,
        cacheWriteTokens: existing.cacheWriteTokens + args.cacheWriteTokens,
      });
    } else {
      await ctx.db.insert("usageWeeks", {
        userId: args.userId,
        weekStart,
        microUsd: micro,
        inputTokens: args.uncachedInputTokens,
        outputTokens: args.outputTokens,
        cacheReadTokens: args.cacheReadTokens,
        cacheWriteTokens: args.cacheWriteTokens,
      });
    }
  },
});

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Wired into the Agent constructor (chat.ts); fires after each generation.
 * AI SDK v6 semantics: usage.inputTokens INCLUDES cached tokens, and the
 * Anthropic provider reports cache write tokens in providerMetadata.
 * Verify once against a real generation (see the env-setup task) — if
 * inputTokens turns out to exclude cache tokens, drop the subtraction.
 */
export const usageHandler: UsageHandler = async (ctx, args) => {
  if (!args.userId) return;
  const meta = (args.providerMetadata?.anthropic ?? {}) as Record<
    string,
    unknown
  >;
  const cacheWriteTokens = toCount(meta.cacheCreationInputTokens);
  const cacheReadTokens =
    args.usage.cachedInputTokens ?? toCount(meta.cacheReadInputTokens);
  const inputTokens = toCount(args.usage.inputTokens);
  const outputTokens = toCount(args.usage.outputTokens);
  const uncachedInputTokens = Math.max(
    0,
    inputTokens - cacheReadTokens - cacheWriteTokens,
  );
  try {
    await ctx.runMutation(internal.usage.recordUsage, {
      userId: args.userId,
      model: args.model,
      uncachedInputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
    });
  } catch (error) {
    // Metering must never take down a reply; worst case is one unmetered
    // generation, which we log.
    console.error("usageHandler: failed to record usage", error);
  }
};

/**
 * Enforcement, called from chat mutations BEFORE saving the prompt.
 * Free: hard 20 queries/calendar month, counted transactionally here.
 * Paid: hard cap at 100% of the weekly budget.
 */
export async function assertUnderLimitAndCount(
  ctx: MutationCtx,
  userId: string,
  planId: PlanId,
): Promise<void> {
  const now = Date.now();
  const plan = PLANS[planId];
  if (plan.weeklyBudgetMicroUsd === null) {
    const monthStart = monthStartUtc(now);
    const row = await ctx.db
      .query("usageMonths")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthStart", monthStart),
      )
      .unique();
    if ((row?.queries ?? 0) >= FREE_MONTHLY_QUERY_LIMIT) {
      throw new ConvexError({ code: "USAGE_LIMIT", planId });
    }
    if (row) {
      await ctx.db.patch(row._id, { queries: row.queries + 1 });
    } else {
      await ctx.db.insert("usageMonths", { userId, monthStart, queries: 1 });
    }
    return;
  }
  const weekStart = weekStartUtc(now);
  const row = await ctx.db
    .query("usageWeeks")
    .withIndex("by_user_week", (q) =>
      q.eq("userId", userId).eq("weekStart", weekStart),
    )
    .unique();
  if ((row?.microUsd ?? 0) >= plan.weeklyBudgetMicroUsd) {
    throw new ConvexError({ code: "USAGE_LIMIT", planId });
  }
}

export type UsageSummary =
  | {
      planId: "free";
      planLabel: string;
      kind: "queries";
      used: number;
      limit: number;
      resetsAt: number;
    }
  | {
      planId: PlanId;
      planLabel: string;
      kind: "budget";
      usedUsd: number;
      weeklyBudgetUsd: number;
      resetsAt: number;
    };

export const getUsage = query({
  args: {},
  handler: async (ctx): Promise<UsageSummary | null> => {
    const result: { userId: string; planId: PlanId } | null =
      await ctx.runQuery(api.polar.getPlanForCurrentUser, {});
    if (!result) return null;
    const { userId, planId } = result;
    const plan = PLANS[planId];
    const now = Date.now();

    if (plan.weeklyBudgetMicroUsd === null) {
      const row = await ctx.db
        .query("usageMonths")
        .withIndex("by_user_month", (q) =>
          q.eq("userId", userId).eq("monthStart", monthStartUtc(now)),
        )
        .unique();
      return {
        planId: "free",
        planLabel: plan.label,
        kind: "queries",
        used: row?.queries ?? 0,
        limit: FREE_MONTHLY_QUERY_LIMIT,
        resetsAt: nextMonthlyResetUtc(now),
      };
    }

    const row = await ctx.db
      .query("usageWeeks")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", userId).eq("weekStart", weekStartUtc(now)),
      )
      .unique();
    return {
      planId,
      planLabel: plan.label,
      kind: "budget",
      usedUsd: (row?.microUsd ?? 0) / 1_000_000,
      weeklyBudgetUsd: plan.weeklyBudgetMicroUsd / 1_000_000,
      resetsAt: nextWeeklyResetUtc(now),
    };
  },
});
