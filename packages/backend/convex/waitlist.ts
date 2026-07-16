import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Client input is untrusted: normalize case/whitespace so the same address
// can't create duplicate rows, and re-validate the format since Convex
// mutations are public and the client-side check can be bypassed entirely.
function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    throw new Error("Invalid email address");
  }
  return normalized;
}

export const join = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (existing) return;
    await ctx.db.insert("waitlist", { email: normalized });
  },
});

export const isRegistered = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) return false;
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    return !!existing;
  },
});
