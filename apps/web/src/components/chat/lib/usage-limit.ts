import { ConvexError } from "convex/values";

/** Message for a USAGE_LIMIT ConvexError; null for anything else. */
export function usageLimitMessage(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as { code?: string; planId?: string } | undefined;
  if (data?.code !== "USAGE_LIMIT") return null;
  return data.planId === "free"
    ? "You've used all 20 free queries this month. Upgrade for more."
    : "You've reached your weekly usage limit. Upgrade your plan or wait for the reset.";
}
