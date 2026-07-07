import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const vMode = v.union(
  v.literal("qa"),
  v.literal("devils-advocate"),
  v.literal("comparison"),
  v.literal("catechism"),
  v.literal("library"),
  v.literal("scripture-study"),
  v.literal("sermon-prep"),
  // Legacy modes — kept so existing conversations remain valid.
  v.literal("debate-prep"),
  v.literal("resources"),
);

/** Mirrors ConversationSetup from lib/studyData.ts. */
export const vSetup = {
  framework: v.optional(v.string()),
  subTradition: v.optional(v.string()),
  opposing: v.optional(v.string()),
  traditions: v.optional(v.array(v.string())),
  document: v.optional(v.string()),
  purpose: v.optional(v.string()),
  collection: v.optional(v.string()),
};

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
  }).index("by_email", ["email"]),

  conversations: defineTable({
    userId: v.string(),
    threadId: v.string(),
    mode: vMode,
    title: v.string(),
    ...vSetup,
  })
    .index("by_user", ["userId"])
    .index("by_thread", ["threadId"]),

  usageWeeks: defineTable({
    userId: v.string(),
    weekStart: v.number(), // ms epoch of Monday 00:00 UTC
    microUsd: v.number(), // accumulated API cost, millionths of a dollar
    inputTokens: v.number(), // uncached input tokens
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheWriteTokens: v.number(),
  }).index("by_user_week", ["userId", "weekStart"]),

  usageMonths: defineTable({
    userId: v.string(),
    monthStart: v.number(), // ms epoch of the 1st, 00:00 UTC
    queries: v.number(), // free-tier query counter
  }).index("by_user_month", ["userId", "monthStart"]),
});
