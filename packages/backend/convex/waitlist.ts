import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";

import { authComponent } from "./auth";
import { sendEmail } from "./lib/email";
import { renderEmail } from "./lib/emailTemplate";

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

// --- Beta access -----------------------------------------------------------

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Approve a waitlist email for beta and (re)issue its personal token. Upserts
// the row so an approval never fails on a not-yet-registered address. Internal:
// only callable from the Convex dashboard / approveBeta, never by the public.
export const setBetaToken = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    const token = generateToken();
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { betaApproved: true, betaToken: token });
    } else {
      await ctx.db.insert("waitlist", {
        email: normalized,
        betaApproved: true,
        betaToken: token,
      });
    }
    // SITE_URL may carry a trailing slash; strip it so we don't emit `//api`.
    const siteUrl = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
    const url = `${siteUrl}/api/beta?token=${token}`;
    return { email: normalized, url };
  },
});

// Is this email a currently-approved beta tester? Shared by the plan
// resolution seam (getPlanIdForUser) to grant Ministry-level access. Plain
// helper (not a Convex function) so it's unit-testable via t.run.
export async function emailHasBeta(
  ctx: QueryCtx,
  email: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return false;
  const row = await ctx.db
    .query("waitlist")
    .withIndex("by_email", (q) => q.eq("email", normalized))
    .first();
  return !!row?.betaApproved;
}

// Beta check by Convex user id: resolves the user's email via better-auth,
// then defers to emailHasBeta. Internal — consumed by getPlanIdForUser.
export const isBetaApprovedUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<boolean> => {
    const user = await authComponent.getAnyUserById(ctx, userId);
    if (!user?.email) return false;
    return emailHasBeta(ctx, user.email);
  },
});

// Bearer check for the /api/beta route: hand back the email only for a token
// that belongs to a currently-approved row. Reveals nothing without the token.
export const resolveBetaToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!token) return null;
    const row = await ctx.db
      .query("waitlist")
      .withIndex("by_token", (q) => q.eq("betaToken", token))
      .first();
    if (!row || !row.betaApproved) return null;
    return { email: row.email };
  },
});

// Cut off a beta user: clears approval + token so their link stops working.
// An already-issued cookie still lapses on its own 30-day expiry.
export const revokeBeta = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        betaApproved: undefined,
        betaToken: undefined,
      });
    }
  },
});

// Send the personal magic link via Resend. Exported for direct testing;
// approveBeta is the normal entry point. Throws on a non-2xx so the caller
// (and the dashboard) sees the failure and can fall back to the returned URL.
export async function sendBetaInvite(email: string, url: string): Promise<void> {
  const { html, text } = renderEmail({
    preheader: "Your personal invitation to the Theologia beta.",
    heading: "You're in.",
    paragraphs: [
      "Your access to the Theologia private beta is ready. Use the button below to open the app.",
      "This link is tied to your email — please keep it to yourself.",
    ],
    button: { label: "Enter Theologia", url },
  });
  await sendEmail({
    to: email,
    subject: "Your Theologia beta invitation",
    html,
    text,
  });
}

// Dashboard entry point: approve an email, mint its link, and email it. Returns
// the URL as a copy-paste fallback if delivery needs to be done by hand.
export const approveBeta = internalAction({
  args: { email: v.string() },
  // Explicit annotations break the self-referential type cycle: this action
  // reads `internal.waitlist`, which includes `approveBeta` itself.
  handler: async (ctx, { email }): Promise<{ url: string }> => {
    const { email: normalized, url }: { email: string; url: string } =
      await ctx.runMutation(internal.waitlist.setBetaToken, { email });
    await sendBetaInvite(normalized, url);
    return { url };
  },
});
