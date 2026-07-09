import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { latestPerTopic } from "./lib/profile";
import { buildProfileMarkdown, type ExportPosition } from "./lib/profile-export";
import { getFramework } from "./lib/studyData";
import { getPlanIdForUser } from "./polar";

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function settingsForUser(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Doc<"profileSettings"> | null> {
  return await ctx.db
    .query("profileSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function upsertSettings(
  ctx: MutationCtx,
  userId: string,
  patch: { optedIn?: boolean; paused?: boolean },
): Promise<void> {
  const existing = await settingsForUser(ctx, userId);
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, decidedAt: Date.now() });
  } else {
    await ctx.db.insert("profileSettings", {
      userId,
      optedIn: patch.optedIn ?? false,
      paused: patch.paused ?? false,
      decidedAt: Date.now(),
    });
  }
}

async function assertOwnPosition(
  ctx: MutationCtx,
  userId: string,
  positionId: Id<"positions">,
): Promise<Doc<"positions">> {
  const position = await ctx.db.get(positionId);
  if (!position || position.userId !== userId) {
    throw new Error("Position not found");
  }
  return position;
}

function toPositionView(doc: Doc<"positions">) {
  return {
    id: doc._id,
    locus: doc.locus,
    topic: doc.topic,
    statement: doc.statement,
    stance: doc.stance,
    strength: doc.strength,
    frameworkAtTime: doc.frameworkAtTime,
    sourceConversationId: doc.sourceConversationId,
    createdAt: doc._creationTime,
    userEdited: doc.userEdited,
    excluded: doc.excluded,
  };
}

async function visiblePositions(ctx: QueryCtx, userId: string) {
  const docs = await ctx.db
    .query("positions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return latestPerTopic(docs.map(toPositionView));
}

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const planId = await getPlanIdForUser(ctx, user._id);
    const settings = await settingsForUser(ctx, user._id);
    const optedIn = settings?.optedIn ?? false;
    const paused = settings?.paused ?? false;
    if (planId === "free" || !optedIn) {
      return { planId, optedIn, paused, positions: [] };
    }
    return {
      planId,
      optedIn,
      paused,
      positions: await visiblePositions(ctx, user._id),
    };
  },
});

export const setOptIn = mutation({
  args: { optedIn: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await upsertSettings(ctx, user._id, { optedIn: args.optedIn });
  },
});

export const setPaused = mutation({
  args: { paused: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await upsertSettings(ctx, user._id, { paused: args.paused });
  },
});

export const editPosition = mutation({
  args: { positionId: v.id("positions"), statement: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await assertOwnPosition(ctx, user._id, args.positionId);
    const statement = args.statement.trim();
    if (!statement) throw new Error("Statement is empty");
    await ctx.db.patch(args.positionId, { statement, userEdited: true });
  },
});

export const excludePosition = mutation({
  args: { positionId: v.id("positions"), excluded: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await assertOwnPosition(ctx, user._id, args.positionId);
    await ctx.db.patch(args.positionId, { excluded: args.excluded });
  },
});

export const deletePosition = mutation({
  args: { positionId: v.id("positions") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await assertOwnPosition(ctx, user._id, args.positionId);
    await ctx.db.delete(args.positionId);
  },
});

/** One-click delete-everything: positions and settings, back to never-opted-in. */
export const deleteAllProfileData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const positions = await ctx.db
      .query("positions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const position of positions) {
      await ctx.db.delete(position._id);
    }
    const settings = await settingsForUser(ctx, user._id);
    if (settings) await ctx.db.delete(settings._id);
  },
});

export const exportProfile = query({
  args: {},
  handler: async (ctx): Promise<string> => {
    const user = await requireUser(ctx);
    const positions = await visiblePositions(ctx, user._id);
    const exportPositions: ExportPosition[] = positions.map((p) => ({
      locus: p.locus,
      topic: p.topic,
      statement: p.statement,
      stance: p.stance,
      strength: p.strength,
      frameworkLabel: p.frameworkAtTime
        ? (getFramework(p.frameworkAtTime)?.label ?? p.frameworkAtTime)
        : undefined,
      createdAt: p.createdAt,
    }));
    return buildProfileMarkdown(exportPositions, Date.now());
  },
});
