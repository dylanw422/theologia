import { anthropic } from "@ai-sdk/anthropic";
import {
  Agent,
  createThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { authComponent } from "./auth";
import { PLANS } from "./lib/plans";
import { buildSystemPrompt } from "./lib/prompts";
import { deriveTitle, isSetupValid } from "./lib/studyData";
import { getPlanIdForUser } from "./polar";
import { scheduleExtraction } from "./profile";
import { vMode, vSetup } from "./schema";
import { assertUnderLimitAndCount, usageHandler } from "./usage";

export const theologiaAgent = new Agent(components.agent, {
  name: "Theologia",
  languageModel: anthropic("claude-sonnet-5"),
  usageHandler,
});

const REPLY_ERROR_TEXT =
  "Something went wrong while composing this reply. Please send your message again.";

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export const createConversation = mutation({
  args: {
    mode: vMode,
    setup: v.object(vSetup),
    firstMessage: v.string(),
  },
  returns: v.id("conversations"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!isSetupValid(args.mode, args.setup)) {
      throw new Error("Incomplete setup for this mode");
    }
    const text = args.firstMessage.trim();
    if (!text) throw new Error("Message is empty");

    const planId = await getPlanIdForUser(ctx, user._id);
    await assertUnderLimitAndCount(ctx, user._id, planId);

    const threadId = await createThread(ctx, components.agent, {
      userId: user._id,
    });
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt: text,
    });
    const conversationId = await ctx.db.insert("conversations", {
      userId: user._id,
      threadId,
      mode: args.mode,
      title: deriveTitle(text),
      ...args.setup,
    });
    await ctx.scheduler.runAfter(0, internal.chat.streamReply, {
      conversationId,
      threadId,
      promptMessageId: messageId,
    });
    await scheduleExtraction(ctx, {
      conversationId,
      userId: user._id,
      planId,
    });
    return conversationId;
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }
    const text = args.text.trim();
    if (!text) throw new Error("Message is empty");

    const planId = await getPlanIdForUser(ctx, user._id);
    await assertUnderLimitAndCount(ctx, user._id, planId);

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: conversation.threadId,
      prompt: text,
    });
    await ctx.scheduler.runAfter(0, internal.chat.streamReply, {
      conversationId: args.conversationId,
      threadId: conversation.threadId,
      promptMessageId: messageId,
    });
    await scheduleExtraction(ctx, {
      conversationId: args.conversationId,
      userId: user._id,
      planId,
    });
  },
});

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) return null;
    return conversation;
  },
});

export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .unique();
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Thread not found");
    }
    const paginated = await listUIMessages(ctx, components.agent, args);
    const streams = await syncStreams(ctx, components.agent, args);
    return { ...paginated, streams };
  },
});

export const getConversationInternal = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => ctx.db.get(args.conversationId),
});

export const streamReply = internalAction({
  args: {
    conversationId: v.id("conversations"),
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.runQuery(
      internal.chat.getConversationInternal,
      { conversationId: args.conversationId },
    );
    if (!conversation) return;

    const system = buildSystemPrompt(conversation.mode, conversation);
    try {
      const planId = await getPlanIdForUser(ctx, conversation.userId);
      const model = anthropic(PLANS[planId].model);
      const result = await theologiaAgent.streamText(
        ctx,
        { threadId: args.threadId },
        { promptMessageId: args.promptMessageId, system, model },
        { saveStreamDeltas: { chunking: "word" } },
      );
      await result.consumeStream();
    } catch (error) {
      console.error("streamReply failed", error);
      // Surface a visible assistant-side error so the client is never left hanging.
      await saveMessage(ctx, components.agent, {
        threadId: args.threadId,
        message: { role: "assistant", content: REPLY_ERROR_TEXT },
      });
    }
  },
});
