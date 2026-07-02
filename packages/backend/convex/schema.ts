import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const vMode = v.union(
  v.literal("qa"),
  v.literal("devils-advocate"),
  v.literal("comparison"),
  v.literal("debate-prep"),
  v.literal("catechism"),
  v.literal("resources"),
  v.literal("library"),
  v.literal("scripture-study"),
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
});
