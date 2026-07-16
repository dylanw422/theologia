import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
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
    const url = `${process.env.SITE_URL}/api/beta?token=${token}`;
    return { email: normalized, url };
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
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Theologia <beta@theologia.app>",
      to: email,
      subject: "Your Theologia beta invitation",
      text: `You're in. Open Theologia with your personal link:\n\n${url}\n\nThis link is tied to your email — please don't share it.`,
      html: `<p>You're in. Open Theologia with your personal link:</p><p><a href="${url}">Enter Theologia</a></p><p style="color:#666;font-size:13px">This link is tied to your email — please don't share it.</p>`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
  }
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
