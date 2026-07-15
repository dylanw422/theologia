import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { getFramework } from "./lib/studyData";

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function preferencesForUser(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"userPreferences"> | null> {
  return await ctx.db
    .query("userPreferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function upsertDefaultFramework(
  ctx: MutationCtx,
  userId: string,
  framework: string,
): Promise<void> {
  if (!getFramework(framework)) {
    throw new Error(`Unknown tradition: ${framework}`);
  }
  const existing = await preferencesForUser(ctx, userId);
  if (existing) {
    await ctx.db.patch(existing._id, { defaultFramework: framework });
  } else {
    await ctx.db.insert("userPreferences", { userId, defaultFramework: framework });
  }
}

export const getDefaultFramework = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const prefs = await preferencesForUser(ctx, user._id);
    return prefs?.defaultFramework ?? null;
  },
});

export const setDefaultFramework = mutation({
  args: { framework: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await upsertDefaultFramework(ctx, user._id, args.framework);
    return null;
  },
});
