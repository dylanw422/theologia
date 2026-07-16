import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { vLocus, vStance, vStrength } from "./lib/profile";

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
    // Beta access: an approved waitlist row carries a random, reusable token.
    // The token is the secret in a personal magic link; redeeming it opens the
    // site before the global SITE_LIVE launch. Revoke by clearing both fields.
    betaApproved: v.optional(v.boolean()),
    betaToken: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_token", ["betaToken"]),

  conversations: defineTable({
    userId: v.string(),
    threadId: v.string(),
    mode: vMode,
    title: v.string(),
    ...vSetup,
    // Theological Profile extraction bookkeeping (all optional — pre-profile
    // conversations have none of these).
    lastMessageAt: v.optional(v.number()),
    pendingExtractionId: v.optional(v.id("_scheduled_functions")),
    // Delta high-water mark: agent-component message `order` already extracted.
    lastExtractedOrder: v.optional(v.number()),
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

  // Theological Profile — append-only ledger of positions the user has
  // affirmed in their own voice. New claims on a topic append; they never
  // overwrite. docs/THEOLOGICAL_PROFILE.md.
  positions: defineTable({
    userId: v.string(),
    locus: vLocus,
    topic: v.string(), // slug, e.g. "election", "baptismal-efficacy"
    statement: v.string(), // one sentence, user's voice
    stance: vStance,
    strength: vStrength,
    sourceConversationId: v.id("conversations"),
    frameworkAtTime: v.optional(v.string()),
    excluded: v.boolean(), // user hid it from the profile
    userEdited: v.boolean(), // statement hand-edited by the user
  })
    .index("by_user", ["userId"])
    .index("by_user_locus", ["userId", "locus"])
    .index("by_user_topic", ["userId", "topic"]),

  profileSettings: defineTable({
    userId: v.string(),
    optedIn: v.boolean(), // off by default; nothing extracts until true
    paused: v.boolean(), // stops extraction without deleting anything
    decidedAt: v.number(), // ms epoch of the last opt-in/out decision
  }).index("by_user", ["userId"]),

  // Per-user default tradition, set at signup and editable on /profile.
  // Pre-fills new conversations' setup; per-conversation overrides via
  // SetupPicker never write back here.
  userPreferences: defineTable({
    userId: v.string(),
    defaultFramework: v.string(), // Framework.id from lib/studyData.ts FRAMEWORKS
  }).index("by_user", ["userId"]),

  // Theological Profile Phase 2 — detected tensions between affirmed
  // positions. One tension per position pair, ever: dismissed and resolved
  // pairs never resurface. docs/THEOLOGICAL_PROFILE.md §Tensions.
  tensions: defineTable({
    userId: v.string(),
    positionAId: v.id("positions"),
    positionBId: v.id("positions"),
    description: v.string(), // neutral, 1–2 sentences; what sits uneasily
    historicalNote: v.optional(v.string()), // how the tradition has handled it
    salience: v.number(), // 1–3, judge-assigned; drives "strongest first"
    status: v.union(
      v.literal("open"),
      v.literal("resolved"),
      v.literal("dismissed"),
    ),
    resolution: v.optional(v.string()), // user's own words, when resolved
    decidedAt: v.optional(v.number()), // ms epoch of resolve/dismiss
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),
});
