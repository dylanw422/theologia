import { anthropic } from "@ai-sdk/anthropic";
import { listMessages } from "@convex-dev/agent";
import { generateText } from "ai";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
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
import {
  buildExtractionPrompt,
  buildTranscript,
  parseExtractionResponse,
} from "./lib/extraction";
import type { PlanId } from "./lib/plans";
import { latestPerTopic, vLocus, vStance, vStrength } from "./lib/profile";
import { buildProfileMarkdown, type ExportPosition } from "./lib/profileExport";
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

export const EXTRACTION_IDLE_MS = 30 * 60 * 1000; // spec: ~30 minutes idle

/**
 * Debounced extraction scheduling. Called after every saved user message:
 * cancels the conversation's pending extraction job (if any) and schedules a
 * fresh one EXTRACTION_IDLE_MS out, so extraction runs once per idle period.
 * planId is passed in because the chat mutations have already resolved it.
 */
export async function scheduleExtraction(
  ctx: MutationCtx,
  args: {
    conversationId: Id<"conversations">;
    userId: string;
    planId: PlanId;
  },
): Promise<void> {
  if (args.planId === "free") return;
  const settings = await settingsForUser(ctx, args.userId);
  if (!settings?.optedIn || settings.paused) return;

  const conversation = await ctx.db.get(args.conversationId);
  if (!conversation) return;
  if (conversation.pendingExtractionId) {
    await ctx.scheduler.cancel(conversation.pendingExtractionId);
  }
  const jobId = await ctx.scheduler.runAfter(
    EXTRACTION_IDLE_MS,
    internal.profile.extractPositions,
    { conversationId: args.conversationId },
  );
  await ctx.db.patch(args.conversationId, {
    pendingExtractionId: jobId,
    lastMessageAt: Date.now(),
  });
}

export const getExtractionContext = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;
    const settings = await settingsForUser(ctx, conversation.userId);
    return {
      userId: conversation.userId,
      threadId: conversation.threadId,
      mode: conversation.mode,
      framework: conversation.framework,
      lastExtractedOrder: conversation.lastExtractedOrder ?? -1,
      eligible: (settings?.optedIn ?? false) && !(settings?.paused ?? false),
    };
  },
});

const vClaim = v.object({
  locus: vLocus,
  topic: v.string(),
  statement: v.string(),
  stance: vStance,
  strength: vStrength,
});

export const recordExtraction = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.string(),
    claims: v.array(vClaim),
    lastExtractedOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;
    for (const claim of args.claims) {
      await ctx.db.insert("positions", {
        userId: args.userId,
        ...claim,
        sourceConversationId: args.conversationId,
        frameworkAtTime: conversation.framework,
        excluded: false,
        userEdited: false,
      });
    }
    await ctx.db.patch(args.conversationId, {
      lastExtractedOrder: args.lastExtractedOrder,
      pendingExtractionId: undefined,
    });
    if (args.claims.length > 0) {
      await ctx.scheduler.runAfter(0, internal.tensions.detectTensions, {
        userId: args.userId,
        claimLoci: [...new Set(args.claims.map((claim) => claim.locus))],
        framework: conversation.framework,
      });
    }
  },
});

export const clearPendingExtraction = internalMutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;
    await ctx.db.patch(args.conversationId, { pendingExtractionId: undefined });
  },
});

/**
 * The extraction pass (docs/THEOLOGICAL_PROFILE.md §How It Works). Runs one
 * Haiku call over the new transcript segment; any failure extracts nothing
 * (fail closed) but always clears the pending-job marker.
 */
export const extractPositions = internalAction({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.profile.getExtractionContext, {
      conversationId: args.conversationId,
    });
    if (!context) return;

    try {
      // Re-check eligibility: the user may have paused or opted out (or
      // downgraded) during the idle window.
      const planId = await getPlanIdForUser(ctx, context.userId);
      if (planId === "free" || !context.eligible) {
        await ctx.runMutation(internal.profile.clearPendingExtraction, {
          conversationId: args.conversationId,
        });
        return;
      }

      const page = await listMessages(ctx, components.agent, {
        threadId: context.threadId,
        paginationOpts: { numItems: 200, cursor: null },
        excludeToolMessages: true,
      });
      const newSegment = page.page
        .filter((m) => m.order > context.lastExtractedOrder)
        .sort((a, b) => a.order - b.order || a.stepOrder - b.stepOrder);
      const hasNewUserTurn = newSegment.some(
        (m) => m.message?.role === "user" && (m.text?.trim() ?? "") !== "",
      );
      if (!hasNewUserTurn) {
        await ctx.runMutation(internal.profile.clearPendingExtraction, {
          conversationId: args.conversationId,
        });
        return;
      }

      const transcript = buildTranscript(
        newSegment.map((m) => ({
          role: m.message?.role ?? "assistant",
          text: m.text,
        })),
      );
      const result = await generateText({
        model: anthropic("claude-haiku-4-5"),
        system: buildExtractionPrompt(context.mode, context.framework),
        prompt: transcript,
        maxOutputTokens: 2000,
      });
      const claims = parseExtractionResponse(result.text);

      const lastExtractedOrder = Math.max(
        ...newSegment.map((m) => m.order),
        context.lastExtractedOrder,
      );
      await ctx.runMutation(internal.profile.recordExtraction, {
        conversationId: args.conversationId,
        userId: context.userId,
        claims,
        lastExtractedOrder,
      });
    } catch (error) {
      console.error("extractPositions failed", error);
      await ctx.runMutation(internal.profile.clearPendingExtraction, {
        conversationId: args.conversationId,
      });
    }
  },
});
