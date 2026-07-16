import { Polar } from "@convex-dev/polar";

import { api, components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { action, internalAction, query } from "./_generated/server";
import { effectivePlan, planFromProductKey, type PlanId } from "./lib/plans";

type CurrentSubscription = Awaited<ReturnType<Polar<DataModel>["getCurrentSubscription"]>>;

export const polar: Polar<DataModel> = new Polar<DataModel>(components.polar, {
  getUserInfo: async (ctx) => {
    const user = await ctx.runQuery(api.auth.getCurrentUser);

    if (!user) {
      throw new Error("Not authenticated");
    }

    if (!user.email) {
      throw new Error("Authenticated user is missing an email address");
    }

    return {
      userId: user._id,
      email: user.email,
    };
  },
  products: {
    scholar: process.env.POLAR_PRODUCT_SCHOLAR!,
    ministry: process.env.POLAR_PRODUCT_MINISTRY!,
    churchTeam: process.env.POLAR_PRODUCT_CHURCH_TEAM!,
  },
});

export const {
  changeCurrentSubscription,
  cancelCurrentSubscription,
  getConfiguredProducts,
  listAllProducts,
  listAllSubscriptions,
  generateCheckoutLink,
  generateCustomerPortalUrl,
} = polar.api();

export const getCurrentSubscription = query({
  args: {},
  handler: async (ctx): Promise<CurrentSubscription | null> => {
    const user = await ctx.runQuery(api.auth.getCurrentUser);

    if (!user) {
      return null;
    }

    return await polar.getCurrentSubscription(ctx, {
      userId: user._id,
    });
  },
});

type RunQueryCtx = Parameters<Polar<DataModel>["getCurrentSubscription"]>[0];

/**
 * Resolve a user's effective plan. Starts from their Polar subscription
 * (no sub → free), then grants beta testers at least Ministry access. This is
 * the single seam every consumer (mode gating, usage limits, tensions,
 * profile) reads, so the beta bump applies everywhere.
 */
export async function getPlanIdForUser(
  ctx: RunQueryCtx,
  userId: string,
): Promise<PlanId> {
  const subscription = await polar.getCurrentSubscription(ctx, { userId });
  const subPlan = planFromProductKey(subscription?.productKey);
  const isBeta = await ctx.runQuery(internal.waitlist.isBetaApprovedUser, {
    userId,
  });
  return effectivePlan(subPlan, isBeta);
}

export const getPlanForCurrentUser = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ userId: string; planId: PlanId } | null> => {
    const user = await ctx.runQuery(api.auth.getCurrentUser);
    if (!user) return null;
    return {
      userId: user._id,
      planId: await getPlanIdForUser(ctx, user._id),
    };
  },
});

export const syncProducts = action({
  args: {},
  handler: async (ctx): Promise<void> => {
    const user = await ctx.runQuery(api.auth.getCurrentUser);

    if (!user) {
      throw new Error("Not authenticated");
    }

    await polar.syncProducts(ctx);
  },
});

// Operational sync for the CLI/dashboard (internal functions aren't callable
// from clients): `bunx convex run polar:syncProductsInternal`.
export const syncProductsInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    await polar.syncProducts(ctx);
  },
});
